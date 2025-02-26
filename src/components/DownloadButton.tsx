import { useState, useEffect } from 'react';
import { DownloadButtonProps, VideoQuality } from '@/types';

export function DownloadButton({
  videoInfo,
  onDownloadStart,
  onDownloadComplete,
  onError,
  isDownloading
}: DownloadButtonProps) {
  const [progress, setProgress] = useState(0);
  const [downloadStats, setDownloadStats] = useState({
    speed: '0 KB/s',
    downloaded: '0 MB',
    total: 'Unknown'
  });
  const [selectedQuality, setSelectedQuality] = useState<VideoQuality>('medium');

  // Poll for progress updates when downloading
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isDownloading) {
      // Start with 0 progress
      setProgress(0);
      
      // Poll for progress updates less frequently (every 2 seconds)
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`/api/progress?url=${encodeURIComponent(videoInfo.directDownloadUrl)}`);
          if (response.ok) {
            const data = await response.json();
            setProgress(data.progress || 0);
            setDownloadStats({
              speed: data.speed || '0 KB/s',
              downloaded: data.downloaded || '0 MB',
              total: data.total || 'Unknown'
            });
            
            // If download is complete, clear interval
            if (data.progress >= 100) {
              clearInterval(intervalId);
            }
          }
        } catch (error) {
          console.error('Error fetching progress:', error);
        }
      }, 2000); // Poll every 2 seconds instead of 500ms
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isDownloading, videoInfo.directDownloadUrl]);

  const handleDownload = async () => {
    try {
      onDownloadStart();
      
      // Create a hidden download link
      const downloadLink = document.createElement('a');
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      
      // Start the download using fetch to get a blob
      const response = await fetch(`/api/download?url=${encodeURIComponent(videoInfo.directDownloadUrl)}&quality=${selectedQuality}`);
      
      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Set up the download link
      downloadLink.href = url;
      downloadLink.download = `${videoInfo.title}.${videoInfo.format}`;
      
      // Trigger the download
      downloadLink.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(downloadLink);
      
      // Complete the download
      onDownloadComplete();
    } catch (error) {
      console.error('Download failed:', error);
      onError(error instanceof Error ? error.message : 'Failed to download video');
      onDownloadComplete();
    }
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-col gap-2 mb-2">
        <label className="text-sm text-gray-600 dark:text-gray-300">Quality:</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedQuality('low')}
            className={`flex-1 py-1 px-2 text-sm rounded-md ${
              selectedQuality === 'low' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            360p
          </button>
          <button
            type="button"
            onClick={() => setSelectedQuality('medium')}
            className={`flex-1 py-1 px-2 text-sm rounded-md ${
              selectedQuality === 'medium' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            720p
          </button>
          <button
            type="button"
            onClick={() => setSelectedQuality('high')}
            className={`flex-1 py-1 px-2 text-sm rounded-md ${
              selectedQuality === 'high' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            1080p
          </button>
          <button
            type="button"
            onClick={() => setSelectedQuality('ultra')}
            className={`flex-1 py-1 px-2 text-sm rounded-md ${
              selectedQuality === 'ultra' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}
          >
            2160p
          </button>
        </div>
      </div>
      
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="w-full text-center rounded-lg border border-foreground p-3 hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
      >
        {isDownloading ? 'Downloading...' : `Download ${videoInfo.title}`}
      </button>
      
      {isDownloading && (
        <div className="space-y-1">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{downloadStats.downloaded} / {downloadStats.total}</span>
            <span>{downloadStats.speed}</span>
          </div>
        </div>
      )}
    </div>
  );
} 