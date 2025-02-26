import { VideoQuality } from '@/types';

// Define format options for each quality level with better fallback behavior
export const getFormatOptions = (quality: VideoQuality): string[] => {
  switch (quality) {
    case 'low':
      // Try 360p, fallback to any resolution below 480p
      return ['-f', 'bv*[height<=360]+ba/b[height<=360]/18'];
      
    case 'medium':
      // Try 720p, fallback to 480p, then 360p
      return ['-f', 'bv*[height<=720]+ba/b[height<=720]/bv*[height<=480]+ba/b[height<=480]/18'];
      
    case 'high':
      // Try 1080p, fallback to 720p, then 480p
      return ['-f', 'bv*[height<=1080]+ba/b[height<=1080]/bv*[height<=720]+ba/b[height<=720]/bv*[height<=480]+ba/b[height<=480]/18'];
      
    case 'ultra':
      // Try 4K/2160p, fallback to 1440p, 1080p, 720p
      return ['-f', 'bv*[height<=2160]+ba/b[height<=2160]/bv*[height<=1440]+ba/b[height<=1440]/bv*[height<=1080]+ba/b[height<=1080]/bv*[height<=720]+ba/b[height<=720]'];
      
    default:
      // Default to medium quality fallback chain
      return ['-f', 'bv*[height<=720]+ba/b[height<=720]/bv*[height<=480]+ba/b[height<=480]/18'];
  }
};

// Get quality options for the frontend
export const getQualityOptions = (): Record<VideoQuality, string> => {
  return {
    low: 'bv*[height<=360]+ba/b[height<=360]/18',
    medium: 'bv*[height<=720]+ba/b[height<=720]/bv*[height<=480]+ba/b[height<=480]/18',
    high: 'bv*[height<=1080]+ba/b[height<=1080]/bv*[height<=720]+ba/b[height<=720]/bv*[height<=480]+ba/b[height<=480]/18',
    ultra: 'bv*[height<=2160]+ba/b[height<=2160]/bv*[height<=1440]+ba/b[height<=1440]/bv*[height<=1080]+ba/b[height<=1080]/bv*[height<=720]+ba/b[height<=720]'
  };
}; 