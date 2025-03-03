import youtubedl from 'youtube-dl-exec';
import { VideoQuality } from '@/types';
import { getFormatOptions } from '@/utils/videoFormats';
import path from 'path';

// Configure youtube-dl-exec to use the system-installed yt-dlp binary
const ytdlpPath = '/Users/philipv/Documents/VSCodeProjects/viddl/venv/bin/yt-dlp';
const customYoutubeDl = youtubedl.create(ytdlpPath);

// Test function to verify youtube-dl-exec is working
export async function testYoutubeDl(url: string) {
  try {
    console.log('Testing youtube-dl-exec with URL:', url);
    console.log('Using yt-dlp binary at:', ytdlpPath);
    
    // Get basic info using --get-title
    const { stdout, stderr } = await customYoutubeDl.exec(url, {
      getTitle: true,
      noWarnings: true,
      callHome: false
    });
    
    console.log('youtube-dl test result - stdout:', stdout);
    console.log('youtube-dl test result - stderr:', stderr);
    
    return { success: true, title: stdout.trim() };
  } catch (error) {
    console.error('youtube-dl test error:', error);
    return { success: false, error };
  }
}

// Common options for all yt-dlp commands
const commonOptions = {
  noPlaylist: true,
  noCheckCertificates: true,
  noWarnings: true,
  preferFreeFormats: true,
  addHeader: [
    'referer:youtube.com',
    'user-agent:Mozilla/5.0 (Linux; Android 12; SM-S906N Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.101 Mobile Safari/537.36',
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language: en-US,en;q=0.5',
    'DNT: 1'
  ]
};

// Function to list available formats
export async function listVideoFormats(url: string): Promise<string> {
  console.log(`Listing formats for ${url}...`);
  
  try {
    const result = await customYoutubeDl.exec(url, {
      ...commonOptions,
      listFormats: true
    });
    
    console.log('Available formats:');
    console.log(result.stdout);
    
    return result.stdout;
  } catch (error) {
    console.error('Error listing formats:', error);
    return 'Error listing formats';
  }
}

export async function getVideoMetadata(url: string) {
  console.log(`Fetching metadata for URL: ${url}`);
  console.log('Using yt-dlp binary at:', ytdlpPath);
  
  try {
    // Use exec instead of direct call for more control
    const { stdout, stderr } = await customYoutubeDl.exec(url, {
      dumpSingleJson: true,
      noPlaylist: true,
      noCheckCertificates: true,
      noWarnings: true
    });
    
    console.log('youtube-dl stdout length:', stdout?.length || 0);
    console.log('youtube-dl stderr:', stderr);
    
    if (!stdout) {
      throw new Error('No output from youtube-dl');
    }
    
    try {
      // Parse the JSON output
      const result = JSON.parse(stdout);
      return result;
    } catch (parseError) {
      console.error('Error parsing youtube-dl output:', parseError);
      console.error('Raw output:', stdout.substring(0, 200) + '...');
      throw new Error('Failed to parse video metadata');
    }
  } catch (error) {
    console.error('yt-dlp detailed error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw new Error('Failed to process video');
  }
}

// This function is kept for backward compatibility but is no longer used directly
// The download API now uses youtube-dl-exec directly
export async function streamVideo(url: string, quality: VideoQuality = 'medium') {
  console.warn('streamVideo is deprecated. Use youtube-dl-exec directly in the API route.');
  
  // Get format options based on quality
  const formatArgs = getFormatOptions(quality);
  
  // Convert format options array to object properties for youtube-dl-exec
  const formatOptions: Record<string, any> = {};
  
  // Add format option
  if (formatArgs.length >= 2 && formatArgs[0] === '-f') {
    formatOptions.format = formatArgs[1];
  }
  
  // Execute youtube-dl with the specified options
  const ytDlp = customYoutubeDl.exec(url, {
    ...commonOptions,
    ...formatOptions,
    output: '-', // Output to stdout
  });
  
  return {
    stdout: ytDlp.stdout,
    stderr: ytDlp.stderr,
    kill: ytDlp.kill.bind(ytDlp)
  };
} 