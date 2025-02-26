import { NextResponse } from "next/server";
import { Readable } from 'stream';
import { streamVideo } from "@/server/ytdlp";
import { updateProgress } from "../progress/route";
import { VideoQuality } from "@/types";

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

// Handle both GET and POST requests
async function handler(req: Request) {
  try {
    let url: string | null = null;
    let quality: string | null = null;
    
    // Get URL from either query params (GET) or request body (POST)
    if (req.method === 'GET') {
      const { searchParams } = new URL(req.url);
      url = searchParams.get('url');
      quality = searchParams.get('quality') || 'medium';
    } else {
      const body = await req.json().catch(() => ({}));
      url = body.url;
      quality = body.quality || 'medium';
    }
    
    console.log('Processing URL:', url);
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const ytDlp = await streamVideo(url, quality as VideoQuality || 'medium');
    const stream = Readable.from(ytDlp.stdout);
    
    // Set up error handling and progress tracking
    let totalBytes = 0;
    let downloadedBytes = 0;
    let lastUpdateTime = Date.now();
    let bytesInLastSecond = 0;
    
    ytDlp.stderr.on('data', (data) => {
      const output = data.toString();
      console.log(`yt-dlp stderr: ${output}`);
      
      // Try to parse progress information
      const progressMatch = output.match(/(\d+\.\d+)% of\s+~?(\d+\.\d+)(K|M|G)iB at\s+(\d+\.\d+)(K|M|G)iB\/s/);
      if (progressMatch) {
        const [, percent, size, sizeUnit, speed, speedUnit] = progressMatch;
        
        // Calculate total size in bytes
        let multiplier = 1;
        if (sizeUnit === 'K') multiplier = 1024;
        if (sizeUnit === 'M') multiplier = 1024 * 1024;
        if (sizeUnit === 'G') multiplier = 1024 * 1024 * 1024;
        
        totalBytes = parseFloat(size) * multiplier;
        downloadedBytes = totalBytes * (parseFloat(percent) / 100);
        
        // Calculate speed
        let speedMultiplier = 1;
        if (speedUnit === 'K') speedMultiplier = 1024;
        if (speedUnit === 'M') speedMultiplier = 1024 * 1024;
        if (speedUnit === 'G') speedMultiplier = 1024 * 1024 * 1024;
        
        const bytesPerSecond = parseFloat(speed) * speedMultiplier;
        
        // Update progress
        updateProgress(url!, {
          progress: parseFloat(percent),
          speed: `${speed} ${speedUnit}B/s`,
          downloaded: `${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB`,
          total: `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
        });
      }
    });

    // Create response headers
    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Content-Disposition', `attachment; filename="video.mp4"`);

    return new NextResponse(stream as any, {
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

export const GET = handler;
export const POST = handler; 