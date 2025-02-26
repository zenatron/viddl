// Keep this as a client-side wrapper for the API
import { VideoInfo } from '@/types';

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  try {
    const normalizedUrl = url.trim();
    
    // Call our API to get video info
    const response = await fetch('/api/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: normalizedUrl }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get video info');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Video processing error:', error);
    throw error;
  }
}