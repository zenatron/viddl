import { spawn } from 'child_process';

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

  return JSON.parse(data);
}

export async function streamVideo(url: string) {
  return spawn(process.env.YTDLP_PATH || 'yt-dlp', [
    '-f', 'b',
    '--no-playlist',
    '-o', '-',
    url
  ]);
} 