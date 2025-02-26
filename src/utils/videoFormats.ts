import { VideoQuality } from '@/types';

// Define format options for each quality level based on available formats
export const getFormatOptions = (quality: VideoQuality): string[] => {
  switch (quality) {
    case 'low':
      // 360p MP4 (single stream with audio)
      return ['-f', '18'];
    case 'medium':
      // 720p - use format 22 if available (single stream with audio)
      return ['-f', '22/18'];
    case 'high':
      // 1080p - prefer single stream formats when available
      return ['-f', 'bv*[height=1080]+ba/b[height=1080]/22/18'];
    case 'ultra':
      // 2160p/4K - prefer single stream formats when available
      return ['-f', 'bv*[height>=2160]+ba/b[height>=2160]/bv*[height=1440]+ba/b[height=1440]/22'];
    default:
      return ['-f', '22/18']; // Default to 720p or 360p
  }
};

// Get quality options for the frontend
export const getQualityOptions = (): Record<VideoQuality, string> => {
  return {
    low: '18', // 360p
    medium: '22/18', // 720p
    high: 'bv*[height=1080]+ba/b[height=1080]/22/18', // 1080p
    ultra: 'bv*[height>=2160]+ba/b[height>=2160]/bv*[height=1440]+ba/b[height=1440]/22' // 2160p/4K
  };
}; 