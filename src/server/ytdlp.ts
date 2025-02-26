import { spawn } from 'child_process';
import { VideoQuality } from '@/types';
import { getFormatOptions } from '@/utils/videoFormats';

// New function to list available formats
export async function listVideoFormats(url: string): Promise<string> {
  console.log(`Listing formats for ${url}...`);
  
  const ytDlp = spawn(process.env.YTDLP_PATH || 'yt-dlp', [
    '--list-formats',
    '--no-playlist',
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
    '-j',
    '--no-playlist',
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
    ...formatArgs,
    '--no-playlist',
    '-o', '-',
    '--no-warnings',
    url
  ];
  
  // Log the command for debugging
  console.log('yt-dlp command:', process.env.YTDLP_PATH || 'yt-dlp', args.join(' '));
  
  return spawn(process.env.YTDLP_PATH || 'yt-dlp', args);
} 