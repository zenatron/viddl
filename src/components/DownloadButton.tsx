import { formatBytes } from '@/utils/formatters';

type DownloadButtonProps = {
  videoInfo: {
    directDownloadUrl: string;
    title: string;
    format: string;
  };
  onDownloadStart: () => void;
  onDownloadProgress: (progress: number) => void;
  onDownloadStats: (stats: {
    speed: string;
    downloaded: string;
    total: string;
  }) => void;
  onDownloadComplete: () => void;
  onError: (error: string) => void;
  isDownloading: boolean;
};

export function DownloadButton({
  videoInfo,
  onDownloadStart,
  onDownloadProgress,
  onDownloadStats,
  onDownloadComplete,
  onError,
  isDownloading
}: DownloadButtonProps) {
  const handleDownload = async () => {
    try {
      onDownloadStart();
      
      const response = await fetch("/api/download/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: videoInfo.directDownloadUrl,
          filename: `${videoInfo.title}.${videoInfo.format}`
        })
      });
      
      const reader = response.body?.getReader();
      const contentLength = +(response.headers.get('Content-Length') || 0);
      
      let receivedLength = 0;
      const chunks = [];
      let lastTime = Date.now();
      let lastLoaded = 0;
      
      while(true && reader) {
        const {done, value} = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        // Calculate download speed
        const currentTime = Date.now();
        const timeElapsed = (currentTime - lastTime) / 1000;
        if (timeElapsed >= 1) {
          const loadedSinceLastUpdate = receivedLength - lastLoaded;
          const speed = loadedSinceLastUpdate / timeElapsed;
          
          onDownloadStats({
            speed: `${formatBytes(speed)}/s`,
            downloaded: formatBytes(receivedLength),
            total: formatBytes(contentLength)
          });
          
          lastTime = currentTime;
          lastLoaded = receivedLength;
        }
        
        onDownloadProgress(Math.round((receivedLength / contentLength) * 100));
      }
      
      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoInfo.title}.${videoInfo.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      onDownloadComplete();
    } catch (error) {
      console.error('Download failed:', error);
      onError('Failed to download video');
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