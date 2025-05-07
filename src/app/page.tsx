"use client";

import { useState } from "react";
import { getVideoInfo } from "@/utils/videoHandler";
import { useDownloads } from "@/context/DownloadsContext";
import { ActiveDownloadsList } from "@/components/ActiveDownloadsList";
import { VideoQuality } from "@/types";

type VideoInfo = {
  url: string;
  title: string;
  format: string;
  sourceUrl?: string;
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
  const [selectedQuality, setSelectedQuality] =
    useState<VideoQuality>("medium");

  const { addDownload } = useDownloads();

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
        setError(
          err.message ||
            "Failed to find video. Please check the URL and try again.",
        );
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!videoInfo?.sourceUrl) {
      setError("Cannot start download: Video info or source URL missing.");
      return;
    }
    setError("");

    addDownload({
      url: videoInfo.url,
      filename: videoInfo.title,
      quality: selectedQuality,
    }).catch((err) => {
      console.error("Error calling addDownload:", err);
      setError(err.message || "Failed to add download to queue.");
    });
  };

  // Add handler for Enter key
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      handleCheck();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-grow flex items-center justify-center">
        <main className="flex flex-col gap-8 row-start-2 items-center w-full max-w-2xl px-4">
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

            {error && <p className="text-error text-sm">{error}</p>}

            <button
              onClick={handleCheck}
              disabled={isLoading}
              className="w-full rounded-lg bg-foreground text-background p-3 hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-background"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Checking URL...
                </>
              ) : (
                "Check Video"
              )}
            </button>

            {videoInfo?.sourceUrl && (
              <div className="w-full space-y-4">
                <div className="flex flex-col gap-2 mb-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">
                    Quality:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      Object.keys(videoInfo.qualityOptions) as VideoQuality[]
                    ).map((quality) => (
                      <button
                        key={quality}
                        type="button"
                        onClick={() => setSelectedQuality(quality)}
                        className={`flex-1 py-1 px-2 text-sm rounded-md capitalize ${
                          selectedQuality === quality
                            ? "bg-primary text-white"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {quality}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleDownload}
                    className="flex-1 text-center rounded-lg border border-foreground p-3 hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
                  >
                    {`Download ${videoInfo.title}`}
                  </button>

                  <a
                    href={videoInfo.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 flex items-center justify-center rounded-lg border border-foreground hover:bg-foreground hover:text-background transition-colors"
                    title="Open Original Source"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </div>

          <ActiveDownloadsList />
        </main>
      </div>
    </div>
  );
}
