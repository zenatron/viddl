import { NextResponse } from "next/server";
import { getVideoInfo } from "@/utils/videoHandler";
import chromium from '@sparticuz/chromium';

export const runtime = 'nodejs';
export const maxDuration = 60; // seconds

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Get video information
    const videoInfo = await getVideoInfo(url);

    if (!videoInfo.directDownloadUrl) {
      return NextResponse.json({ error: "Could not process video URL" }, { status: 400 });
    }

    // Return the video info
    return NextResponse.json(videoInfo);
  } catch (error) {
    console.error('Puppeteer error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      chromiumPath: await chromium.executablePath(),
      chromiumArgs: chromium.args
    });
    throw error;
  }
} 