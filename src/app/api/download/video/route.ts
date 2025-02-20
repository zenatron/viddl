import { NextResponse } from "next/server";
import { getVideoInfo } from "@/utils/videoHandler";

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Get video information including headers
    const videoInfo = await getVideoInfo(url);

    if (!videoInfo.directDownloadUrl) {
      return NextResponse.json({ error: "Could not process video URL" }, { status: 400 });
    }

    // Fetch the video with the required headers
    const response = await fetch(videoInfo.directDownloadUrl, {
      headers: videoInfo.headers || {}
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }

    // Get the response headers
    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('Content-Type') || 'video/mp4');
    headers.set('Content-Length', response.headers.get('Content-Length') || '');
    headers.set('Content-Disposition', `attachment; filename="${videoInfo.title}.${videoInfo.format}"`);

    // Stream the response
    return new NextResponse(response.body, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Video download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download video" },
      { status: 500 }
    );
  }
} 