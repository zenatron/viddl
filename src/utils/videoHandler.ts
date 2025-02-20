import puppeteer from 'puppeteer';

export type VideoInfo = {
  url: string;
  title: string;
  format: string;
  directDownloadUrl?: string;
  headers?: Record<string, string>;
};

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  try {
    const normalizedUrl = url.trim();
    console.log('Processing URL:', normalizedUrl);
    
    if (isDirectVideoUrl(normalizedUrl)) {
      console.log('Detected as direct video URL');
      const isVideo = await isValidVideoContentType(normalizedUrl, normalizedUrl);
      if (isVideo) {
        console.log('Confirmed as direct video URL');
        return handleDirectVideo(normalizedUrl, normalizedUrl);
      }
      console.log('URL appears to be video but content-type check failed');
    }

    console.log('Checking for embedded video source...');
    const videoSource = await extractEmbeddedVideoSource(normalizedUrl);
    if (videoSource) {
      console.log('Found embedded video source:', videoSource);
      return handleDirectVideo(videoSource, normalizedUrl);
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
    
    let html: string;
    let responseStatus: number = 200;
    
    // First try normal fetch
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': url
        }
      });
      
      responseStatus = response.status;
      if (!response.ok) {
        throw new Error(`Failed to fetch page: ${response.status}`);
      }
      html = await response.text();
    } catch (error) {
      // If fetch fails, try with puppeteer to bypass Cloudflare
      console.log(error,'Fetch failed, trying with puppeteer...');
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      await page.goto(url, {waitUntil: 'networkidle0'});
      html = await page.content();
      await browser.close();
    }

    console.log('Response status:', responseStatus);
    console.log('HTML preview:', html.substring(0, 200));
    console.log('HTML length:', html.length);
    
    // Look specifically for video URLs
    const videoPatterns = [
      // CDN video patterns
      /https?:\/\/(?:cdn|media)[^"'\s]*?\.(?:mp4|webm|ogg|m3u8|mov)(?:\?[^"'\s]*)?/gi,
      // Video with key parameter
      /https?:\/\/[^"'\s]*?(?:key=[^"'\s,]*)[^"'\s]*?\.(?:mp4|webm|ogg|m3u8|mov)/gi,
      // Direct video URLs
      /https?:\/\/[^"'\s]*?\.(?:mp4|webm|ogg|m3u8|mov)(?:\?[^"'\s]*)?(?=["'\s])/gi
    ];

    // Add more logging for pattern matching
    for (const pattern of videoPatterns) {
      console.log('Trying pattern:', pattern.toString());
      const matches = html.match(pattern);
      if (matches) {
        console.log('Found matches:', matches);
        for (const match of matches) {
          if (!match.includes('cloudflare') && !match.includes('analytics')) {
            console.log('Valid video URL found:', match);
            return match;
          }
        }
      }
    }

    // If no matches found, log some page content for debugging
    console.log('Page content snippets:');
    console.log('Title:', html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]);
    console.log('Video tags:', html.match(/<video[^>]*>([\s\S]*?)<\/video>/gi));
    console.log('Script tags count:', (html.match(/<script/gi) || []).length);

    console.log('No video source found in page');
    return null;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to extract video source:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    } else {
      console.error('Failed to extract video source:', String(error));
    }
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

function handleDirectVideo(url: string, originalUrl?: string): VideoInfo {
  try {
    const cleanUrl = url.trim().replace(/\s+/g, '');
    const videoUrl = new URL(cleanUrl);
    const sourceUrl = originalUrl ? new URL(originalUrl) : videoUrl;
    
    // Extract domain and clean it
    const domain = videoUrl.hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/^cdn\./, '')
      .replace(/^cdn\d+\./, '')
      .replace(/-vid-mp4/, '')
      .replace(/\.[^.]+$/, '')
      .replace(/\.[^.]+$/, '')
      .replace(/-cdn$/, '');
    
    const format = 'mp4';

    // Use the source URL's origin for CDN requests
    const refererUrl = videoUrl.hostname.includes('cdn') ? sourceUrl.origin : videoUrl.origin;
    
    return {
      url: videoUrl.href,
      title: `${domain}-download`,
      format,
      directDownloadUrl: videoUrl.href,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'video/webm,video/mp4,video/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': refererUrl,
        'Origin': refererUrl,
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site'
      }
    };
  } catch (error) {
    console.error('Error handling direct video:', error);
    throw new Error('Invalid video URL format');
  }
}

async function isValidVideoContentType(url: string, originalUrl?: string): Promise<boolean> {
  try {
    const videoUrl = new URL(url);
    const sourceUrl = originalUrl ? new URL(originalUrl) : videoUrl;
    const refererUrl = videoUrl.hostname.includes('cdn') ? sourceUrl.origin : videoUrl.origin;

    const response = await fetch(url, { 
      method: 'HEAD',
      headers: {
        'Accept': 'video/*,*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.5',
        'Range': 'bytes=0-0',
        'Referer': refererUrl,
        'Origin': refererUrl
      }
    });
    
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    console.log('Content-Type:', contentType);
    console.log('Content-Length:', contentLength);
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const validTypes = ['video/', 'application/octet-stream'];
    const isVideoType = validTypes.some(type => contentType?.startsWith(type)) || false;
    
    return isVideoType;
  } catch (error) {
    console.error('Content-type check failed:', error);
    return false;
  }
} 