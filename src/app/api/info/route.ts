import { NextResponse } from "next/server";
import { getVideoMetadata, testYoutubeDl } from "@/server/ytdlp";
import { getQualityOptions } from "@/utils/videoFormats";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log('Info API called');
  
  try {
    const { url } = await req.json();
    console.log('Received URL:', url);

    if (!url) {
      console.log('URL is required but was not provided');
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // First test if youtube-dl-exec is working
    console.log('Testing youtube-dl-exec...');
    const testResult = await testYoutubeDl(url);
    console.log('Test result:', testResult);
    
    if (!testResult.success) {
      console.error('youtube-dl-exec test failed');
      return NextResponse.json({ error: "Failed to process video with youtube-dl" }, { status: 500 });
    }
    
    // If test is successful, proceed with getting metadata
    console.log('Calling getVideoMetadata...');
    const videoInfo = await getVideoMetadata(url);
    console.log('Video info received, title:', videoInfo?.title);
    
    if (!videoInfo || !videoInfo.title) {
      // Fallback to test result if metadata doesn't have title
      const response = {
        url: url,
        title: testResult.title || 'video',
        format: 'mp4',
        directDownloadUrl: url,
        qualityOptions: getQualityOptions()
      };
      
      console.log('Returning fallback response with title:', response.title);
      return NextResponse.json(response);
    }
    
    const response = {
      url: url,
      title: videoInfo.title,
      format: videoInfo.ext || 'mp4',
      directDownloadUrl: url,
      qualityOptions: getQualityOptions()
    };
    
    console.log('Returning response with title:', response.title);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Video info error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get video info" },
      { status: 500 }
    );
  }
} 