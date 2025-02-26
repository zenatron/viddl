import { NextResponse } from "next/server";

// In-memory store for download progress
// In a production app, you'd use Redis or another shared store
const downloadProgress = new Map<string, {
  progress: number;
  speed: string;
  downloaded: string;
  total: string;
  lastUpdated: number;
}>();

// Clean up old progress entries
setInterval(() => {
  const now = Date.now();
  for (const [url, data] of downloadProgress.entries()) {
    if (now - data.lastUpdated > 60000) { // Remove after 1 minute of inactivity
      downloadProgress.delete(url);
    }
  }
}, 30000);

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }
    
    // Get progress data for this URL
    const progressData = downloadProgress.get(url) || {
      progress: 0,
      speed: '0 KB/s',
      downloaded: '0 MB',
      total: 'Unknown',
      lastUpdated: Date.now()
    };
    
    return NextResponse.json(progressData);
  } catch (error) {
    console.error('Progress error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get progress" },
      { status: 500 }
    );
  }
}

// Export a function to update progress
export function updateProgress(url: string, data: {
  progress: number;
  speed: string;
  downloaded: string;
  total: string;
}) {
  downloadProgress.set(url, {
    ...data,
    lastUpdated: Date.now()
  });
}