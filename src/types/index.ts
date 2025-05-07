// Video-related types
export type VideoQuality = "low" | "medium" | "high" | "ultra";

export type VideoInfo = {
  url: string;
  title: string;
  format: string;
  sourceUrl?: string;
  qualityOptions: Record<VideoQuality, string>;
};

export type DownloadStats = {
  progress: number;
  speed: string;
  downloaded: string;
  total: string;
  lastUpdated: number;
};

// Component prop types
// Remove DownloadButtonProps as the component is deleted
// export type DownloadButtonProps = {
//   videoInfo: {
//     sourceUrl: string;
//     title: string;
//     format: string;
//     qualityOptions: Record<VideoQuality, string>;
//   };
//   onDownloadStart: () => void;
//   onDownloadComplete: () => void;
//   onError: (error: string) => void;
//   isDownloading: boolean;
// };
