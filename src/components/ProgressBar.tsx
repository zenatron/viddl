export type ProgressBarProps = {
  progress: number;
  stats: {
    speed: string;
    downloaded: string;
    total: string;
    eta?: string;
  };
  status?: "idle" | "downloading" | "complete" | "error";
};

export function ProgressBar({
  progress,
  stats,
  status = "idle",
}: ProgressBarProps) {
  // Helper to determine progress bar color based on status
  const getProgressBarColor = () => {
    switch (status) {
      case "complete":
        return "bg-green-600";
      case "error":
        return "bg-red-600";
      case "downloading":
        return "bg-blue-600";
      default:
        return "bg-gray-600";
    }
  };

  // Helper to format the status message
  const getStatusMessage = () => {
    switch (status) {
      case "complete":
        return "Download complete";
      case "error":
        return "Download failed";
      case "downloading":
        return `Downloading • ${stats.downloaded} of ${stats.total}`;
      default:
        return "Ready to download";
    }
  };

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div
          className={`${getProgressBarColor()} h-2.5 rounded-full transition-all duration-300`}
          style={{
            width: `${progress}%`,
            transition: "width 0.5s ease-in-out",
          }}
        />
      </div>

      {/* Status and stats */}
      <div className="flex flex-wrap justify-between items-center text-sm">
        <div className="text-gray-600 dark:text-gray-400">
          <span className="inline-flex items-center gap-2">
            {status === "downloading" && (
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {getStatusMessage()}
          </span>
        </div>

        {/* Show speed and ETA when downloading */}
        {status === "downloading" && (
          <div className="text-gray-500 dark:text-gray-400 font-mono text-sm flex gap-3">
            <span>{stats.speed}</span>
            {stats.eta && <span>ETA: {stats.eta}</span>}
          </div>
        )}
      </div>

      {/* Show percentage when downloading or complete */}
      {(status === "downloading" || status === "complete") && (
        <div className="text-right text-sm text-gray-500 dark:text-gray-400">
          {progress.toFixed(1)}%
        </div>
      )}
    </div>
  );
}
