import { useState } from 'react';
import { DownloadButtonProps, VideoQuality } from '@/types';
import { ProgressBar } from './ProgressBar';

export function DownloadButton({
  videoInfo,
  onDownloadStart,
  onDownloadComplete,
  onError,
  isDownloading
}: DownloadButtonProps) {
  const [selectedQuality, setSelectedQuality] = useState<VideoQuality>('medium');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStats, setDownloadStats] = useState({
    speed: '0 B/s',
    downloaded: '0 B',
    total: '0 B'
  });
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'complete' | 'error'>('idle');

  const handleDownload = async () => {
    try {
      onDownloadStart();
      setDownloadStatus('downloading');
      
      const response = await fetch(`/api/download?url=${encodeURIComponent(videoInfo.directDownloadUrl)}&quality=${selectedQuality}`);
      
      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let videoData = new Uint8Array();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Check if this is a progress event
        const text = new TextDecoder().decode(value);
        if (text.startsWith('event: progress')) {
          try {
            const jsonStr = text.split('data: ')[1];
            const progressData = JSON.parse(jsonStr);
            
            // Update progress state
            setDownloadProgress(parseFloat(progressData.progress));
            setDownloadStats({
              speed: progressData.speed,
              downloaded: formatBytes(parseInt(progressData.downloaded_bytes)),
              total: formatBytes(parseInt(progressData.total_bytes))
            });
            continue;
          } catch (e) {
            console.error('Error parsing progress data:', e);
          }
        }

        // Accumulate video data
        const newData = new Uint8Array(videoData.length + value.length);
        newData.set(videoData);
        newData.set(value, videoData.length);
        videoData = newData;
      }

      // Create and trigger download
      const blob = new Blob([videoData], { type: 'video/mp4' });
      const url = window.URL.createObjectURL(blob);
      
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `${videoInfo.title}.${videoInfo.format}`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(url);
      
      setDownloadStatus('complete');
      onDownloadComplete();
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadStatus('error');
      onError(error instanceof Error ? error.message : 'Failed to download video');
      onDownloadComplete();
    }
  };

  // Helper function to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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
            Low
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
            Medium
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
            High
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
            Ultra
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

      {/* Progress bar */}
      {(downloadStatus === 'downloading' || downloadStatus === 'complete') && (
        <ProgressBar
          progress={downloadProgress}
          stats={downloadStats}
          status={downloadStatus}
        />
      )}
    </div>
  );
} 