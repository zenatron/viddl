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
            <a
              href={videoInfo.directDownloadUrl}
              download={`${videoInfo.title}.${videoInfo.format}`}
              target="_blank"
              className="block w-full text-center rounded-lg border border-foreground p-3 hover:bg-foreground hover:text-background transition-colors"
            >
              Download {videoInfo.title}
            </a>
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
