'use client';

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
    speed: '0 KiB/s',
    downloaded: '0 MiB',
    total: '0 MiB',
    eta: 'unknown'
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
          console.log(`Fetching progress for ID: ${downloadId}`);
          const response = await fetch(`/api/download?progressId=${downloadId}`);
          
          if (!response.ok) {
            console.error(`Failed to fetch progress: ${response.status}`);
            return;
          }
          
          const data = await response.json();
          console.log('Progress data:', data);
          
          if (data) {
            setDownloadProgress(data.progress || 0);
            setDownloadStats({
              speed: data.speed || '0 KiB/s',
              downloaded: data.downloaded_bytes || '0 MiB',
              total: data.total_bytes || '0 MiB',
              eta: data.eta || 'unknown'
            });
            
            // Update status if provided
            if (data.status) {
              setDownloadStatus(data.status);
              
              // If download is complete, clear the interval and call the completion callback
              if (data.status === 'complete') {
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
                onDownloadComplete?.();
              }
              
              // If there's an error, clear the interval and call the error callback
              if (data.status === 'error') {
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
                onError?.(data.error || 'Download failed');
              }
            }
          }
        } catch (error) {
          console.error('Error fetching progress:', error);
        }
      };
      
      // Initial fetch
      fetchProgress();
      
      // Start polling
      progressIntervalRef.current = setInterval(fetchProgress, 1000);
      
      return () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      };
    }
  }, [downloadId, downloadStatus, onError, onDownloadComplete]); 

  const handleDownload = async () => {
    let newDownloadId: string | null = null; // Define here to be accessible in catch block
    try {
      onDownloadStart();
      setDownloadStatus('downloading');
      setDownloadProgress(0);
      setDownloadStats({ speed: '0 KiB/s', downloaded: '0 MiB', total: '0 MiB', eta: 'unknown' });
      
      // Sanitize filename: Decode URI components first, then replace invalid characters
      const decodedTitle = decodeURIComponent(videoInfo.title);
      const safeFilename = `${decodedTitle.replace(/[^a-zA-Z0-9\s_\-\.]/g, '_')}.mp4`;

      // First, initialize the download and get an ID
      console.log('Initializing download...');
      const initResponse = await fetch(`/api/download?url=${encodeURIComponent(videoInfo.directDownloadUrl)}&quality=${selectedQuality}`, {
        headers: {
          'X-Request-Type': 'init'
        }
      });
      
      if (!initResponse.ok) {
        throw new Error(`Download initialization failed with status: ${initResponse.status}`);
      }
      
      const initData = await initResponse.json();
      newDownloadId = initData.downloadId;
      console.log('Download initialized with ID:', newDownloadId);
      setDownloadId(newDownloadId); // Set download ID to start progress polling
      
      // Construct the final download URL including the filename
      const downloadUrl = `/api/download?url=${encodeURIComponent(videoInfo.directDownloadUrl)}&quality=${selectedQuality}&downloadId=${newDownloadId}&filename=${encodeURIComponent(safeFilename)}`;

      // Create an anchor element to trigger the download
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = safeFilename; // Use the sanitized filename
      // We don't append/remove the link, just click it to start the native download
      downloadLink.click();

      console.log('Browser download initiated for:', downloadUrl);
      // NOTE: We don't wait for the download to finish here.
      // The progress polling mechanism will handle status updates.
      // We also don't call onDownloadComplete() here anymore.
      
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadStatus('error');
      onError(error instanceof Error ? error.message : 'Failed to download video');
      // Clean up interval if an error occurred during init or URL generation
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      // Ensure download ID is reset if initialization failed or link creation failed
      if (!downloadId && newDownloadId) { // If polling hasn't started but we got an ID
        // Optionally, tell the server to clean up (needs backend support)
      } else if (!downloadId) { // If we didn't even get an ID
         onDownloadComplete(); // Signal completion as it truly failed early
      }
      // If polling already started (downloadId is set), the polling useEffect will handle cleanup
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
        disabled={isDownloading || downloadStatus === 'downloading'}
        className="w-full text-center rounded-lg border border-foreground p-3 hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
      >
        {downloadStatus === 'downloading' ? 'Downloading...' : `Download ${videoInfo.title}`}
      </button>

      {/* Progress bar */}
      {downloadStatus !== 'idle' && (
        <ProgressBar 
          progress={downloadProgress} 
          stats={downloadStats}
          status={downloadStatus}
        />
      )}
    </div>
  );
} 