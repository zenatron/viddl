import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { extractTikTokVideo } from './tiktokHandler';

export type VideoInfo = {
  url: string;
  title: string;
  format: string;
  directDownloadUrl?: string;
  headers?: Record<string, string>;
};

export async function getVideoInfo(url: string): Promise<{ directDownloadUrl: string | null, title: string, format: string }> {
  try {
    const normalizedUrl = url.trim();
    console.log('Processing URL:', normalizedUrl);
    
    // Check if it's a TikTok URL
    if (url.includes('tiktok.com')) {
      const videoInfo = await extractTikTokVideo(url);
      if (!videoInfo) return { directDownloadUrl: null, title: 'video', format: 'mp4' };
      
      return {
        directDownloadUrl: videoInfo.url,
        title: videoInfo.title,
        format: videoInfo.format
      };
    }

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
    const videoSource = await extractVideoSource(normalizedUrl);
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

async function extractVideoSource(url: string): Promise<string | null> {
  try {
    // Check if it's a TikTok URL
    if (url.includes('tiktok.com')) {
      const videoInfo = await extractTikTokVideo(url);
      return videoInfo?.url || null;
    }

    // Continue with general video extraction
    return await extractEmbeddedVideoSource(url);
  } catch (error) {
    console.error('Error extracting video source:', error);
    return null;
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
      const browser = await getPuppeteerBrowser();
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      await page.goto(url, {waitUntil: 'networkidle0'});
      html = await page.content();
      await browser.close();
    }

    console.log('Response status:', responseStatus);
    
    // Update the video patterns to remove TikTok specific ones
    const videoPatterns = [
      // General CDN patterns
      /https?:\/\/(?:cdn|media)[^"'\s]*?\.(?:mp4|webm|ogg|m3u8|mov)(?:\?[^"'\s]*)?/gi,
      
      // Video with parameters
      /https?:\/\/[^"'\s]*?(?:video|media)\/[^"'\s]*?\/[^"'\s]*?(?:\?[^"'\s]*)?/gi,
      
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
          // Skip known advertising or analytics URLs
          if (!match.includes('cloudflare') && 
              !match.includes('analytics') && 
              !match.includes('tracking')) {
            console.log('Valid video URL found:', match);
            return match;
          }
        }
      }
    }

    // If no matches found with patterns, try JSON parsing approach
    const jsonMatches = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    for (const script of jsonMatches) {
      try {
        // Look for JSON-like content in script tags
        const jsonContent = script.match(/\{[\s\S]*?\}/g) || [];
        for (const json of jsonContent) {
          try {
            const data = JSON.parse(json);
            // Recursively search for video URLs in the JSON
            const videoUrl = findVideoUrlInObject(data);
            if (videoUrl) {
              console.log('Found video URL in JSON:', videoUrl);
              return videoUrl;
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
      } catch (e) {
        // Ignore script parsing errors
      }
    }

    console.log('No video source found in page');
    return null;
  } catch (error) {
    console.error('Failed to extract video source:', error);
    return null;
  }
}

// Helper function to recursively search for video URLs in objects
function findVideoUrlInObject(obj: any): string | null {
  if (!obj) return null;
  
  if (typeof obj === 'string') {
    // Check if the string is a video URL
    if (isDirectVideoUrl(obj)) {
      return obj;
    }
    return null;
  }
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = findVideoUrlInObject(item);
      if (result) return result;
    }
    return null;
  }
  
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      // Look for properties that might contain video URLs
      if (key.toLowerCase().includes('video') || 
          key.toLowerCase().includes('playurl') || 
          key.toLowerCase().includes('media')) {
        const result = findVideoUrlInObject(obj[key]);
        if (result) return result;
      }
    }
    
    // If no video-related keys found, search all properties
    for (const value of Object.values(obj)) {
      const result = findVideoUrlInObject(value);
      if (result) return result;
    }
  }
  
  return null;
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

async function handleDirectVideo(url: string, originalUrl: string): Promise<{ directDownloadUrl: string | null, title: string, format: string }> {
  if (url.includes('tiktok.com')) {
    const videoInfo = await extractTikTokVideo(url);
    return {
      directDownloadUrl: videoInfo?.url || null,
      title: 'tiktok-video',
      format: 'mp4'
    };
  }
  return {
    directDownloadUrl: url,
    title: 'video',
    format: 'mp4'
  };
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

async function getPuppeteerBrowser() {
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

export { isDirectVideoUrl }; 