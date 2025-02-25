import { NextResponse } from "next/server";
import { Readable } from 'stream';
import { streamVideo } from "@/server/ytdlp";

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

// Handle both GET and POST requests
async function handler(req: Request) {
  try {
    let url: string | null = null;
    
    // Get URL from either query params (GET) or request body (POST)
    if (req.method === 'GET') {
      const { searchParams } = new URL(req.url);
      url = searchParams.get('url');
    } else {
      const body = await req.json().catch(() => ({}));
      url = body.url;
    }
    
    console.log('Processing URL:', url);
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const ytDlp = await streamVideo(url);
    const stream = Readable.from(ytDlp.stdout);
    
    // Set up error handling
    ytDlp.stderr.on('data', (data) => {
      console.error(`yt-dlp stderr: ${data}`);
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