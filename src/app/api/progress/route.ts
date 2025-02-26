import { NextResponse } from "next/server";

// Define a more comprehensive progress type
type DownloadProgress = {
  progress: number;
  speed: string;
  downloaded: string;
  total: string;
  status: 'idle' | 'downloading' | 'complete' | 'error';
  lastUpdated: number;
  error?: string;
};

// In-memory store for download progress
const downloadProgress = new Map<string, DownloadProgress>();

// Clean up old progress entries
setInterval(() => {
  const now = Date.now();
  for (const [url, data] of downloadProgress.entries()) {
    // Remove after 5 minutes of inactivity or if complete/error after 1 minute
    const timeout = ['complete', 'error'].includes(data.status) ? 60000 : 300000;
    if (now - data.lastUpdated > timeout) {
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
      status: 'idle',
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
export function updateProgress(url: string, data: Partial<DownloadProgress>) {
  const currentProgress = downloadProgress.get(url) || {
    progress: 0,
    speed: '0 KB/s',
    downloaded: '0 MB',
    total: 'Unknown',
    status: 'idle',
    lastUpdated: Date.now()
  };

  downloadProgress.set(url, {
    ...currentProgress,
    ...data,
    lastUpdated: Date.now()
  });
}

// Helper functions to update specific progress states
export function initializeProgress(url: string) {
  updateProgress(url, {
    progress: 0,
    speed: '0 KB/s',
    downloaded: '0 MB',
    total: 'Unknown',
    status: 'downloading'
  });
}

export function completeProgress(url: string) {
  updateProgress(url, {
    progress: 100,
    status: 'complete'
  });
}

export function errorProgress(url: string, error: string) {
  updateProgress(url, {
    status: 'error',
    error
  });
}