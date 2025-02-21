import { NextResponse } from "next/server";
import { getVideoInfo } from "@/utils/videoHandler";
import { getTikTokHeaders, verifyTikTokUrl } from "@/utils/tiktokHandler";

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { url, originalUrl } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const videoInfo = await getVideoInfo(url);

    if (!videoInfo.directDownloadUrl) {
      return NextResponse.json({ error: "Could not process video URL" }, { status: 400 });
    }

    const isTikTok = videoInfo.directDownloadUrl.includes('tiktok.com');
    const headers = isTikTok 
      ? getTikTokHeaders(videoInfo.directDownloadUrl, originalUrl || 'https://www.tiktok.com')
      : videoInfo.headers || {};

    // Stream the response
    const response = await fetch(videoInfo.directDownloadUrl, { 
      headers,
      redirect: 'follow',
      mode: 'cors',
      credentials: 'omit'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }

    // Stream the response
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': response.headers.get('Content-Length') || '',
        'Content-Disposition': `attachment; filename="${videoInfo.title}.${videoInfo.format}"`,
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