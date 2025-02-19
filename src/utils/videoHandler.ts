export type VideoInfo = {
  url: string;
  title: string;
  format: string;
  directDownloadUrl?: string;
};

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  try {
    const normalizedUrl = url.trim();
    console.log('Processing URL:', normalizedUrl);
    
    // First check if it's a direct video URL
    if (isDirectVideoUrl(normalizedUrl)) {
      console.log('Detected as direct video URL');
      // Verify with a HEAD request
      const isVideo = await isValidVideoContentType(normalizedUrl);
      if (isVideo) {
        console.log('Confirmed as direct video URL');
        return handleDirectVideo(normalizedUrl);
      }
      console.log('URL appears to be video but content-type check failed');
    }

    // Check for embedded video sources
    console.log('Checking for embedded video source...');
    const videoSource = await extractEmbeddedVideoSource(normalizedUrl);
    if (videoSource) {
      console.log('Found embedded video source:', videoSource);
      return handleDirectVideo(videoSource);
    }

    console.log('No valid video source found');
    throw new Error("Could not find a video source. Please provide a direct video URL or a supported video page.");
  } catch (error) {
    console.error('Video processing error:', error);
    throw error;
  }
}

async function extractEmbeddedVideoSource(url: string): Promise<string | null> {
  try {
    console.log('Fetching page content from:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': url
      }
    });
    const html = await response.text();
    
    // Look specifically for video URLs
    const videoPatterns = [
      // CDN video patterns
      /https?:\/\/(?:cdn|media)[^"'\s]*?\.(?:mp4|webm|ogg|m3u8|mov)(?:\?[^"'\s]*)?/gi,
      // Video with key parameter
      /https?:\/\/[^"'\s]*?(?:key=[^"'\s,]*)[^"'\s]*?\.(?:mp4|webm|ogg|m3u8|mov)/gi,
      // Direct video URLs
      /https?:\/\/[^"'\s]*?\.(?:mp4|webm|ogg|m3u8|mov)(?:\?[^"'\s]*)?(?=["'\s])/gi
    ];

    for (const pattern of videoPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const match of matches) {
          // Exclude Cloudflare and analytics URLs
          if (!match.includes('cloudflare') && !match.includes('analytics')) {
            console.log('Found video URL:', match);
            return match;
          }
        }
      }
    }

    console.log('No video source found in page');
    return null;
  } catch (error) {
    console.error('Failed to extract video source:', error);
    return null;
  }
}

function isDirectVideoUrl(url: string): boolean {
  try {
    const fullUrl = url.toLowerCase();
    
    return (
      /\.(mp4|webm|ogg|m3u8|mov)(?:\?|,|$)/i.test(fullUrl) ||
      /\/(?:cdn|media)\.[\w.-]+\/.*?(?:key=|\.(?:mp4|webm|ogg|m3u8|mov))/i.test(fullUrl)
    );
  } catch (error) {
    console.error('Error checking if URL is direct video:', error);
    return false;
  }
}

function handleDirectVideo(url: string): VideoInfo {
  try {
    // Clean up the URL and ensure it's properly encoded
    const cleanUrl = url.trim().replace(/\s+/g, '');
    const videoUrl = new URL(cleanUrl);
    
    // Extract filename from URL or use generic name
    const filename = decodeURIComponent(videoUrl.pathname.split('/').pop() || 'video');
    const format = getFormatFromUrl(videoUrl.href);
    
    console.log('Processing direct video:', {
      url: videoUrl.href,
      filename,
      format
    });

    return {
      url: videoUrl.href,
      title: filename.replace(/\.[^/.]+$/, ''), // Remove extension from title
      format,
      directDownloadUrl: videoUrl.href
    };
  } catch (error) {
    console.error('Error handling direct video:', error);
    throw new Error('Invalid video URL format');
  }
}

function getFormatFromUrl(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase();
  return extension || 'mp4';
}

async function isValidVideoContentType(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      headers: {
        'Accept': 'video/*'
      }
    });
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    return contentType?.startsWith('video/') || false;
  } catch (error) {
    console.error('Content-type check failed:', error);
    return false;
  }
} 