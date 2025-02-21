import { NextResponse } from "next/server";
import { extractTikTokVideo, downloadTikTokVideo } from "@/utils/tiktokHandler";

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const videoInfo = await extractTikTokVideo(url);
    if (!videoInfo) {
      return NextResponse.json({ error: "Could not find video" }, { status: 404 });
    }

    const response = await downloadTikTokVideo(videoInfo);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to download video" }, { status: response.status });
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': response.headers.get('Content-Length') || '',
        'Content-Disposition': 'attachment; filename="tiktok-video.mp4"',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Video download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download video" },
      { status: 500 }
    );
  }
} 