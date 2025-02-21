import { isDirectVideoUrl } from './videoHandler';

export async function extractTikTokVideo(url: string): Promise<string | null> {
  try {
    console.log('Extracting TikTok video from:', url);
    
    // If it's already a webapp-prime URL, verify and return it
    if (url.includes('webapp-prime') && url.includes('mime_type=video_mp4')) {
      console.log('Direct webapp-prime URL provided');
      const decodedUrl = decodeURIComponent(url);
      const urlObj = new URL(decodedUrl);
      
      // Check expiration time
      const expireTime = parseInt(urlObj.searchParams.get('expire') || '0', 10);
      const currentTime = Math.floor(Date.now() / 1000);  // Convert to Unix timestamp
      
      console.log('URL expiration time:', new Date(expireTime * 1000).toISOString());
      console.log('Current time:', new Date(currentTime * 1000).toISOString());
      
      if (expireTime < currentTime) {
        console.log('URL has expired, need to fetch fresh URL');
        return null;
      }

      const requiredParams = ['signature', 'tk', 'expire', 'policy', 'btag'];
      const hasAllParams = requiredParams.every(param => urlObj.searchParams.has(param));
      
      if (hasAllParams) {
        console.log('URL contains all required signature parameters and is not expired');
        return decodedUrl;
      }
    }

    // First fetch to get TikTok cookies
    const mainResponse = await fetch('https://www.tiktok.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    // Get cookies from the main response
    const cookies = mainResponse.headers.get('set-cookie');
    
    // Now fetch the video page with cookies
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.tiktok.com/',
        'Cookie': cookies || '',
        'Origin': 'https://www.tiktok.com'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch TikTok page: ${response.status}`);
    }

    const html = await response.text();
    
    // Look for webapp-prime TikTok URLs first
    const webappPrimePattern = /https?:\/\/v[0-9]+-webapp-prime\.(?:[^"'\s]*?)\.tiktok\.com\/video\/tos\/[^"'\s]+?\/[^"'\s]+?(?:\?[^"'\s]+)?/g;
    const webappPrimeMatches = html.match(webappPrimePattern);
    
    if (webappPrimeMatches) {
      console.log('Found webapp-prime TikTok URLs:', webappPrimeMatches);
      // Filter out any non-video URLs and decode
      for (const match of webappPrimeMatches) {
        const decodedUrl = decodeURIComponent(match.replace(/\\u002F/g, '/'));
        if (decodedUrl.includes('mime_type=video_mp4')) {
          // Verify the URL is accessible
          try {
            const videoResponse = await fetch(decodedUrl, {
              method: 'HEAD',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url,
                'Cookie': cookies || '',
                'Origin': 'https://www.tiktok.com'
              }
            });
            
            if (videoResponse.ok) {
              console.log('Found valid webapp-prime TikTok video URL:', decodedUrl);
              return decodedUrl;
            }
          } catch (e) {
            console.error('Error verifying video URL:', e);
          }
        }
      }
    }
    
    // TikTok specific patterns as fallback
    const tiktokPatterns = [
      // Main video content
      /"playAddr":"([^"]+)"/,
      /"downloadAddr":"([^"]+)"/,
      /"videoUrl":"([^"]+)"/,
      // Backup patterns for other TikTok domains
      /https?:\/\/[^"'\s]*?(?:v[0-9]+|webapp)\.tiktok\.com\/video\/[^"'\s]+/
    ];

    for (const pattern of tiktokPatterns) {
      const match = html.match(pattern);
      if (match) {
        const videoUrl = match[1] ? decodeURIComponent(match[1].replace(/\\u002F/g, '/')) : match[0];
        if (videoUrl.includes('mime_type=video_mp4')) {
          console.log('Found TikTok video URL:', videoUrl);
          return videoUrl;
        }
      }
    }

    // Try parsing JSON data as last resort
    const jsonData = html.match(/<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/);
    if (jsonData && jsonData[1]) {
      try {
        const data = JSON.parse(jsonData[1]);
        const videoUrl = findTikTokVideoInObject(data);
        if (videoUrl) {
          return videoUrl;
        }
      } catch (e) {
        console.error('Error parsing TikTok JSON data:', e);
      }
    }

    console.log('No TikTok video found in page');
    return null;

  } catch (error) {
    console.error('Failed to extract TikTok video:', error);
    return null;
  }
}

function findTikTokVideoInObject(obj: any): string | null {
  if (!obj) return null;

  if (typeof obj === 'string') {
    const decodedUrl = decodeURIComponent(obj.replace(/\\u002F/g, '/'));
    if (decodedUrl.includes('mime_type=video_mp4')) {
      return decodedUrl;
    }
    return null;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = findTikTokVideoInObject(item);
      if (result) return result;
    }
    return null;
  }

  if (typeof obj === 'object') {
    // TikTok specific keys that might contain video URLs
    const videoKeys = ['playAddr', 'downloadAddr', 'videoUrl', 'video_url', 'playUrl'];
    
    for (const key of videoKeys) {
      if (obj[key]) {
        const result = findTikTokVideoInObject(obj[key]);
        if (result) return result;
      }
    }

    // Search all properties if no video found in specific keys
    for (const value of Object.values(obj)) {
      const result = findTikTokVideoInObject(value);
      if (result) return result;
    }
  }

  return null;
}

// Update the video handler to include TikTok headers
export function getTikTokHeaders(videoUrl: string, pageUrl: string): Record<string, string> {
  const urlObj = new URL(videoUrl);
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'video/webm,video/mp4,video/*;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': pageUrl,  // Use original page URL
    'Origin': new URL(pageUrl).origin,  // Use original page origin
    'Range': 'bytes=0-',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'video',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'Connection': 'keep-alive',
    'Host': urlObj.host,
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache'
  };
}

// Remove verification since we'll try direct streaming
export async function verifyTikTokUrl(): Promise<boolean> {
  return true;
} 