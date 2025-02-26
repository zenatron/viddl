import { spawn } from 'child_process';
import { VideoQuality } from '@/types';
import { getFormatOptions } from '@/utils/videoFormats';

// Common arguments for all yt-dlp commands
const commonArgs = [
  '--no-playlist',
  '--cookies-from-browser', 'chrome',
  '--extractor-args', 'generic:impersonate',
  '--user-agent', 'Mozilla/5.0 (Linux; Android 12; SM-S906N Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.101 Mobile Safari/537.36',
  '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  '--add-header', 'Accept-Language: en-US,en;q=0.5',
  '--add-header', 'DNT: 1',
  '--no-check-certificates',
  '--ignore-errors',
  '--no-warnings'
];

// New function to list available formats
export async function listVideoFormats(url: string): Promise<string> {
  console.log(`Listing formats for ${url}...`);
  
  const ytDlp = spawn(process.env.YTDLP_PATH || 'yt-dlp', [
    ...commonArgs,
    '--list-formats',
    url
  ]);

  let formatOutput = '';
  for await (const chunk of ytDlp.stdout) {
    formatOutput += chunk.toString();
  }

  let errorOutput = '';
  for await (const chunk of ytDlp.stderr) {
    errorOutput += chunk.toString();
  }

  if (errorOutput && !formatOutput) {
    console.error('Error listing formats:', errorOutput);
    return 'Error listing formats';
  }

  console.log('Available formats:');
  console.log(formatOutput);
  
  return formatOutput;
}

export async function getVideoMetadata(url: string) {
  const ytDlp = spawn(process.env.YTDLP_PATH || 'yt-dlp', [
    ...commonArgs,
    '-j',
    url
  ]);

  let data = '';
  for await (const chunk of ytDlp.stdout) {
    data += chunk.toString();
  }

  // Handle errors
  let errorOutput = '';
  for await (const chunk of ytDlp.stderr) {
    errorOutput += chunk.toString();
  }

  if (errorOutput && !data) {
    console.error('yt-dlp error:', errorOutput);
    throw new Error('Failed to process video');
  }

  // List available formats after getting metadata
  await listVideoFormats(url);

  return JSON.parse(data);
}

export async function streamVideo(url: string, quality: VideoQuality = 'medium') {
  // Get format options based on quality
  const formatArgs = getFormatOptions(quality);
  
  // Add common arguments
  const args = [
    ...commonArgs,
    ...formatArgs,
    '-o', '-',
    '--no-warnings',
    '--progress-template', '[download] %(progress._percent_str)j,%(progress.speed)j,%(progress.total_bytes)j,%(progress.downloaded_bytes)j',
    url
  ];
  
  // Log the command for debugging
  const ytDlpPath = process.env.YTDLP_PATH || 'yt-dlp';
  console.log('yt-dlp command:', ytDlpPath, args.join(' '));
  
  const ytDlp = spawn(ytDlpPath, args);
  
  // Create a transform stream to handle progress events
  const { Transform } = require('stream');
  const progressTransform = new Transform({
    transform(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null, data?: Buffer) => void) {
      // Forward the chunk as is
      this.push(chunk);
      callback();
    }
  });

  // Parse progress data from stderr
  ytDlp.stderr.setEncoding('utf8');
  ytDlp.stderr.on('data', (data: string) => {
    try {
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.startsWith('[download]')) {
          // Remove the [download] prefix and split by commas
          const [progress, speed, total, downloaded] = line
            .replace('[download] ', '')
            .split(',')
            .map(val => val.trim());

          // Create progress data object
          const progressData = {
            progress: progress.replace('%', ''),
            speed,
            total_bytes: total,
            downloaded_bytes: downloaded
          };

          // Push progress event to the transform stream
          progressTransform.push(Buffer.from(`event: progress\ndata: ${JSON.stringify(progressData)}\n\n`));
        }
      }
    } catch (error) {
      console.error('Error parsing progress data:', error);
      console.error('Raw line:', data);
    }
  });

  // Pipe stdout through the transform stream
  ytDlp.stdout.pipe(progressTransform);

  return {
    stdout: progressTransform,
    stderr: ytDlp.stderr,
    kill: ytDlp.kill.bind(ytDlp)
  };
} 