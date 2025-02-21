interface VideoInfo {
  url: string;
  title: string;
  format: string;
}

export async function extractTikTokVideo(url: string): Promise<VideoInfo | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html = await response.text();
    
    const patterns = [
      /"playAddr":"([^"]+)"/,
      /"downloadAddr":"([^"]+)"/,
      /"videoUrl":"([^"]+)"/
    ];

    for (const pattern of patterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const match of matches) {
          let videoUrl = match;
          if (match.includes('playAddr":"')) {
            videoUrl = match.split('playAddr":"')[1].split('"')[0];
          }
          videoUrl = decodeURIComponent(videoUrl.replace(/\\u002F/g, '/'));

          if (videoUrl.includes('mime_type=video_mp4')) {
            return {
              url: videoUrl,
              title: 'tiktok-video',
              format: 'mp4'
            };
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting TikTok video:', error);
    return null;
  }
}

export async function downloadTikTokVideo(videoInfo: VideoInfo) {
  const response = await fetch(videoInfo.url, {
    headers: {
      'Accept': '*/*',
      'Accept-Encoding': 'identity;q=1, *;q=0',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
      'DNT': '1',
      'Host': new URL(videoInfo.url).host,
      'Range': 'bytes=0-',
      'Referer': 'https://www.tiktok.com/',
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'same-site',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Chromium";v="133", "Not(A:Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }

  return response;
}