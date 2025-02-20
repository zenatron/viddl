"use client";

import { useState } from "react";
import { version } from '../../package.json';

type VideoInfo = {
  url: string;
  title: string;
  format: string;
  directDownloadUrl?: string;
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const handleCheck = async () => {
    if (!url) {
      setError("Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    setError("");
    setVideoInfo(null);

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to find video");
      }

      const data = await response.json();
      setVideoInfo(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Failed to find video. Please check the URL and try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Add handler for Enter key
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      handleCheck();
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center">viddl</h1>
        
        <div className="w-full space-y-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Paste video URL here..."
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
          
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            onClick={handleCheck}
            disabled={isLoading}
            className="w-full rounded-lg bg-foreground text-background p-3 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isLoading ? "Checking URL..." : "Check Video"}
          </button>

          {videoInfo?.directDownloadUrl && (
            <div className="w-full space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      if (!videoInfo.directDownloadUrl) return;
                      setIsDownloading(true);
                      setDownloadProgress(0);
                      
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
                      
                      while(true && reader) {
                        const {done, value} = await reader.read();
                        
                        if (done) break;
                        
                        chunks.push(value);
                        receivedLength += value.length;
                        setDownloadProgress(Math.round((receivedLength / contentLength) * 100));
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
                    } catch (error) {
                      console.error('Download failed:', error);
                      setError('Failed to download video');
                    } finally {
                      setIsDownloading(false);
                      setDownloadProgress(0);
                    }
                  }}
                  disabled={isDownloading}
                  className="flex-1 text-center rounded-lg border border-foreground p-3 hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
                >
                  {isDownloading ? 'Downloading...' : `Download ${videoInfo.title}`}
                </button>
                
                <a
                  href={videoInfo.directDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 flex items-center justify-center rounded-lg border border-foreground hover:bg-foreground hover:text-background transition-colors"
                  title="Open processed URL"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
              
              {isDownloading && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center text-sm text-gray-600 dark:text-gray-400">
        <span>© {new Date().getFullYear()} viddl</span>
        <span>•</span>
        <span>For personal use only</span>
        <span>•</span>
        <span>Use responsibly</span>
        <span>•</span>
        <span>v{version}</span>
      </footer>
    </div>
  );
}
