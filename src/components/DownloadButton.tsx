import { useState, useEffect, useRef } from 'react';
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
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  // Poll for progress updates
  useEffect(() => {
    // Clear any existing interval first
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    if (downloadId && downloadStatus === 'downloading') {
      const fetchProgress = async () => {
        try {
          const response = await fetch(`/api/download?progressId=${downloadId}`);
          if (response.ok) {
            const progressData = await response.json();
            
            // Update progress state
            setDownloadProgress(progressData.progress);
            setDownloadStats({
              speed: progressData.speed || '0 B/s',
              downloaded: progressData.downloaded_bytes || '0 B',
              total: progressData.total_bytes || '0 B'
            });
            
            // Check if download is complete or has error
            if (progressData.status === 'complete') {
              setDownloadStatus('complete');
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
            } else if (progressData.status === 'error') {
              setDownloadStatus('error');
              onError(progressData.error || 'Download failed');
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
            }
          }
        } catch (error) {
          console.error('Error fetching progress:', error);
        }
      };
      
      // Start polling
      progressIntervalRef.current = setInterval(fetchProgress, 1000);
      
      return () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      };
    }
  }, [downloadId, downloadStatus, onError]); // Remove progressInterval from dependencies

  const handleDownload = async () => {
    try {
      onDownloadStart();
      setDownloadStatus('downloading');
      setDownloadProgress(0);
      
      // First, initialize the download and get an ID
      const initResponse = await fetch(`/api/download?url=${encodeURIComponent(videoInfo.directDownloadUrl)}&quality=${selectedQuality}`, {
        headers: {
          'X-Request-Type': 'init'
        }
      });
      
      if (!initResponse.ok) {
        throw new Error(`Download initialization failed with status: ${initResponse.status}`);
      }
      
      const { downloadId: newDownloadId } = await initResponse.json();
      setDownloadId(newDownloadId);
      
      // Now start the actual download
      const response = await fetch(`/api/download?url=${encodeURIComponent(videoInfo.directDownloadUrl)}&quality=${selectedQuality}`);
      
      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }
      
      // Get the response as a blob
      const blob = await response.blob();
      
      // Create and trigger download
      const url = window.URL.createObjectURL(blob);
      
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `${videoInfo.title}.mp4`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(url);
      
      setDownloadStatus('complete');
      setDownloadProgress(100);
      onDownloadComplete();
      
      // Clean up interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadStatus('error');
      onError(error instanceof Error ? error.message : 'Failed to download video');
      onDownloadComplete();
      
      // Clean up interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
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