import { NextResponse } from "next/server";
import { streamVideo } from "@/server/ytdlp";
import { VideoQuality } from "@/types";
import { Readable } from 'stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: Request) {
  let url: string | null = null;
  let quality: string | null = null;
  
  try {
    // Get URL and quality from request
    if (req.method === 'GET') {
      const { searchParams } = new URL(req.url);
      url = searchParams.get('url');
      quality = searchParams.get('quality') || 'medium';
    } else {
      const body = await req.json().catch(() => ({}));
      url = body.url;
      quality = body.quality || 'medium';
    }

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const ytDlp = await streamVideo(url, quality as VideoQuality);
    
    // Set up SSE for progress events
    const encoder = new TextEncoder();
    let videoStream = new Uint8Array();
    
    const stream = new ReadableStream({
      start(controller) {
        ytDlp.stdout.on('data', (chunk: Buffer) => {
          // Check if chunk is a progress event
          const chunkStr = chunk.toString();
          if (chunkStr.startsWith('event: progress')) {
            controller.enqueue(encoder.encode(chunkStr));
          } else {
            // Accumulate video data
            const newStream = new Uint8Array(videoStream.length + chunk.length);
            newStream.set(videoStream);
            newStream.set(chunk, videoStream.length);
            videoStream = newStream;
          }
        });

        ytDlp.stdout.on('end', () => {
          // Send the video data as the final chunk
          controller.enqueue(videoStream);
          controller.close();
        });

        ytDlp.stdout.on('error', (err: Error) => controller.error(err));
      },
    });

    const headers = new Headers();
    headers.set('Content-Type', 'text/event-stream');
    headers.set('Cache-Control', 'no-cache');
    headers.set('Connection', 'keep-alive');

    return new NextResponse(stream, {
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