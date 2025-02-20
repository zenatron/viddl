"use client";

import { useState } from "react";
import { DownloadButton } from "@/components/DownloadButton";
import { ProgressBar } from "@/components/ProgressBar";
import { Footer } from "@/components/Footer";

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
  const [downloadStats, setDownloadStats] = useState<{
    speed: string;
    downloaded: string;
    total: string;
  }>({ speed: '0 KB/s', downloaded: '0 MB', total: '0 MB' });

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
                <DownloadButton
                  videoInfo={{
                    directDownloadUrl: videoInfo.directDownloadUrl,
                    title: videoInfo.title,
                    format: videoInfo.format
                  }}
                  onDownloadStart={() => {
                    setIsDownloading(true);
                    setDownloadProgress(0);
                  }}
                  onDownloadProgress={setDownloadProgress}
                  onDownloadStats={setDownloadStats}
                  onDownloadComplete={() => {
                    setIsDownloading(false);
                    setDownloadProgress(0);
                  }}
                  onError={setError}
                  isDownloading={isDownloading}
                />
                
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
                <ProgressBar
                  progress={downloadProgress}
                  stats={downloadStats}
                />
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
