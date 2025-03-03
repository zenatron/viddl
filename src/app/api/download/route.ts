import { NextResponse } from "next/server";
import { VideoQuality } from "@/types";
import youtubedl from 'youtube-dl-exec';
import { getFormatOptions } from "@/utils/videoFormats";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Configure youtube-dl-exec to use the system-installed yt-dlp binary
const ytdlpPath = process.env.YTDLP_PATH;
const customYoutubeDl = youtubedl.create(ytdlpPath as string);

// Store download progress for each request
const progressMap = new Map<string, any>();

async function handler(req: Request) {
  let url: string | null = null;
  let quality: string | null = null;
  
  try {
    // Get URL and quality from request
    if (req.method === 'GET') {
      const { searchParams } = new URL(req.url);
      url = searchParams.get('url');
      quality = searchParams.get('quality') || 'medium';
      
      // Check if this is a progress request
      const progressId = searchParams.get('progressId');
      if (progressId) {
        return handleProgressRequest(progressId);
      }
    } else {
      const body = await req.json().catch(() => ({}));
      url = body.url;
      quality = body.quality || 'medium';
    }

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Generate a unique ID for this download
    const downloadId = Date.now().toString();
    
    // Initialize progress for this download
    progressMap.set(downloadId, {
      progress: 0,
      speed: '0KiB/s',
      total_bytes: '0MiB',
      downloaded_bytes: '0MiB',
      status: 'starting'
    });

    console.log(`Download request for URL: ${url}, quality: ${quality}, ID: ${downloadId}`);
    console.log('Using yt-dlp binary at:', ytdlpPath);
    
    // Return the download ID immediately
    if (req.headers.get('x-request-type') === 'init') {
      return NextResponse.json({ downloadId });
    }
    
    // Start the download process
    const videoStream = new ReadableStream({
      start(controller) {
        // Get format options based on quality
        const formatArgs = getFormatOptions(quality as VideoQuality);
        
        // Convert format options array to object properties for youtube-dl-exec
        const formatOptions: Record<string, any> = {};
        
        // Basic options
        formatOptions.noCheckCertificates = true;
        formatOptions.noWarnings = true;
        formatOptions.preferFreeFormats = true;
        formatOptions.output = '-'; // Output to stdout
        
        // Force MP4 container with compatible codecs
        formatOptions.format = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
        
        // Override with quality-specific format if provided
        if (formatArgs.length >= 2 && formatArgs[0] === '-f') {
          formatOptions.format = formatArgs[1];
        }
        
        // Force remuxing to MP4
        formatOptions.remuxVideo = 'mp4';
        
        // Add headers
        formatOptions.addHeader = [
          'referer:youtube.com',
          'user-agent:Mozilla/5.0 (Linux; Android 12; SM-S906N Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.101 Mobile Safari/537.36'
        ];
        
        console.log('Executing youtube-dl with options:', formatOptions);
        
        // Execute youtube-dl with the specified options using our custom instance
        const ytDlp = customYoutubeDl.exec(url as string, formatOptions);
        
        // Flag to track if controller is already closed
        let controllerClosed = false;
        
        // Update progress map with status
        progressMap.set(downloadId, {
          ...progressMap.get(downloadId),
          status: 'downloading'
        });
        
        // Handle progress events from stderr
        ytDlp.stderr?.on('data', (data: Buffer) => {
          const stderr = data.toString();
          console.log('yt-dlp stderr:', stderr);
          
          // Look for download progress in stderr
          if (stderr.includes('[download]')) {
            const lines = stderr.split('\n');
            for (const line of lines) {
              if (line.includes('[download]') && line.includes('%')) {
                try {
                  // Extract progress percentage
                  const progressMatch = line.match(/(\d+\.\d+)%/);
                  if (progressMatch && progressMatch[1]) {
                    const progress = parseFloat(progressMatch[1]);
                    
                    // Extract speed if available
                    let speed = '0KiB/s';
                    const speedMatch = line.match(/at\s+([\d.]+\w+\/s)/);
                    if (speedMatch && speedMatch[1]) {
                      speed = speedMatch[1];
                    }
                    
                    // Extract size if available
                    let totalSize = '0MiB';
                    const sizeMatch = line.match(/of\s+(~?[\d.]+\w+)/);
                    if (sizeMatch && sizeMatch[1]) {
                      totalSize = sizeMatch[1];
                    }
                    
                    // Calculate downloaded bytes
                    const downloadedBytes = totalSize !== '0MiB' 
                      ? `${(progress / 100 * parseFloat(totalSize)).toFixed(2)}${totalSize.replace(/[\d.]+/, '')}`
                      : '0MiB';
                    
                    // Update progress map
                    progressMap.set(downloadId, {
                      progress,
                      speed,
                      total_bytes: totalSize,
                      downloaded_bytes: downloadedBytes,
                      status: 'downloading'
                    });
                  }
                } catch (error) {
                  console.error('Error parsing progress data:', error);
                }
              }
            }
          }
        });
        
        // Handle video data from stdout
        ytDlp.stdout?.on('data', (chunk: Buffer) => {
          if (!controllerClosed) {
            controller.enqueue(chunk);
          }
        });
        
        // Handle end of stream
        ytDlp.stdout?.on('end', () => {
          if (!controllerClosed) {
            // Update progress map with completion status
            progressMap.set(downloadId, {
              ...progressMap.get(downloadId),
              progress: 100,
              status: 'complete'
            });
            
            // Schedule cleanup of progress data
            setTimeout(() => {
              progressMap.delete(downloadId);
            }, 60000); // Remove after 1 minute
            
            controllerClosed = true;
            controller.close();
          }
        });
        
        // Handle errors
        ytDlp.on('error', (err: Error) => {
          console.error('Process error:', err);
          
          // Update progress map with error status
          progressMap.set(downloadId, {
            ...progressMap.get(downloadId),
            status: 'error',
            error: err.message
          });
          
          if (!controllerClosed) {
            controllerClosed = true;
            controller.error(err);
          }
        });
      }
    });

    // Set appropriate headers for video streaming
    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Cache-Control', 'no-cache');
    headers.set('Connection', 'keep-alive');
    headers.set('X-Download-ID', downloadId);

    return new NextResponse(videoStream, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process video" },
      { status: 500 }
    );
  }
}

// Handle progress requests
function handleProgressRequest(progressId: string) {
  const progress = progressMap.get(progressId);
  
  if (!progress) {
    return NextResponse.json({ error: "Download not found" }, { status: 404 });
  }
  
  return NextResponse.json(progress);
}

export const GET = handler;
export const POST = handler; 