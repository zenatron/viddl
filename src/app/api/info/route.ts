import { NextResponse } from "next/server";
import { getVideoMetadata } from "@/server/ytdlp";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const videoData = await getVideoMetadata(url);
    
    return NextResponse.json({
      url: url,
      title: videoData.title || 'video',
      format: videoData.ext || 'mp4',
      directDownloadUrl: url
    });
  } catch (error) {
    console.error('Video info error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get video info" },
      { status: 500 }
    );
  }
} 