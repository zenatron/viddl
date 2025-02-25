import { useState } from 'react';

type DownloadButtonProps = {
  videoInfo: {
    directDownloadUrl: string;
    title: string;
    format: string;
  };
  onDownloadStart: () => void;
  onDownloadComplete: () => void;
  onError: (error: string) => void;
  isDownloading: boolean;
};

export function DownloadButton({
  videoInfo,
  onDownloadStart,
  onDownloadComplete,
  onError,
  isDownloading
}: DownloadButtonProps) {
  const handleDownload = async () => {
    try {
      onDownloadStart();
      
      // Simple approach - open in new tab
      window.open(`/api/download?url=${encodeURIComponent(videoInfo.directDownloadUrl)}`, '_blank');
      
      // Mark as complete after a short delay
      setTimeout(() => {
        onDownloadComplete();
      }, 1000);
      
    } catch (error) {
      console.error('Download failed:', error);
      onError(error instanceof Error ? error.message : 'Failed to download video');
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className="flex-1 text-center rounded-lg border border-foreground p-3 hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
    >
      {isDownloading ? 'Downloading...' : `Download ${videoInfo.title}`}
    </button>
  );
} 