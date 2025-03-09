"use client";

import { useState } from "react";
import { DownloadButton } from "@/components/DownloadButton";
import { ProgressBar } from "@/components/ProgressBar";
import Footer from "@/components/Footer";
import { getVideoInfo } from "@/utils/videoHandler";
import Header from "@/components/Header";
type VideoInfo = {
  url: string;
  title: string;
  format: string;
  directDownloadUrl?: string;
  qualityOptions: {
    low: string;
    medium: string;
    high: string;
    ultra: string;
  };
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
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
      // Get video info using our utility
      const info = await getVideoInfo(url);
      setVideoInfo(info);
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
    <div className="min-h-screen bg-background flex flex-col">

      <Header />
      <div className="flex-grow flex items-center justify-center">
        <main className="flex flex-col gap-8 row-start-2 items-center w-full max-w-2xl">
          
        <div className="w-full space-y-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Paste video URL here..."
            autoFocus
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
          
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            onClick={handleCheck}
            disabled={isLoading}
            className="w-full rounded-lg bg-foreground text-background p-3 hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking URL...
              </>
            ) : (
              "Check Video"
            )}
          </button>

          {videoInfo?.directDownloadUrl && (
            <div className="w-full space-y-2">
              <div className="flex gap-2">
                <DownloadButton
                  videoInfo={{
                    directDownloadUrl: videoInfo.directDownloadUrl,
                    title: videoInfo.title,
                    format: videoInfo.format,
                    qualityOptions: {
                      low: videoInfo.qualityOptions.low,
                      medium: videoInfo.qualityOptions.medium,
                      high: videoInfo.qualityOptions.high,
                      ultra: videoInfo.qualityOptions.ultra
                    }
                  }}
                  onDownloadStart={() => {
                    setIsDownloading(true);
                  }}
                  onDownloadComplete={() => {
                    setIsDownloading(false);
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
            </div>
          )}
        </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
