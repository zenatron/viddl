import React, { useEffect, useRef, useCallback } from "react";
import { useDownloads, DownloadItem } from "@/context/DownloadsContext";
import { ProgressBar } from "./ProgressBar";
import { ProgressBarProps } from "./ProgressBar"; // Import ProgressBarProps type

// Helper function to map DownloadItem status to ProgressBar status
const mapStatusForProgressBar = (
  status: DownloadItem["status"],
): ProgressBarProps["status"] => {
  switch (status) {
    case "downloading":
      return "downloading";
    case "complete":
      return "complete";
    case "error":
      return "error";
    case "starting": // Treat starting as downloading for progress bar
      return "downloading";
    case "pending": // Treat pending as idle
    case "cancelled": // Treat cancelled as idle for the bar itself
      return "idle";
    default:
      return "idle";
  }
};

export function ActiveDownloadsList() {
  const { downloads, updateDownloadProgress, removeDownload, cancelDownload, clearAllDownloads } =
    useDownloads();

  // Ref to hold the latest downloads state for the polling function
  const downloadsRef = useRef<DownloadItem[]>(downloads);

  // Ref for the polling interval ID
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Effect to keep the downloadsRef updated
  useEffect(() => {
    downloadsRef.current = downloads;
  }, [downloads]);

  // Stable polling function using useCallback and reading from ref
  const poll = useCallback(async () => {
    // Read the latest downloads from the ref
    const currentDownloads = downloadsRef.current;
    const activeDownloads = currentDownloads.filter(
      (d) =>
        (d.status === "starting" || d.status === "downloading") &&
        !d.id.startsWith("temp-"),
    );

    if (activeDownloads.length === 0) {
      // TODO: Stop the interval when no active downloads
      return;
    }

    const activeIds = activeDownloads.map((d) => d.id);
    console.log(
      `[ActiveDownloadsList] Poll function CALLED for IDs: ${activeIds.join(", ")}`,
    );

    try {
      const response = await fetch(
        `/api/download?progressId=${activeIds.join(",")}`,
      );

      if (!response.ok) {
        console.error(
          `Polling failed for batch ${activeIds.join(", ")}: ${response.status}`,
        );
        activeIds.forEach((id) =>
          updateDownloadProgress(id, {
            status: "error",
            error: `Polling failed (${response.status})`,
          }),
        );
        return;
      }

      const batchData: Record<string, DownloadItem> = await response.json();

      for (const [id, data] of Object.entries(batchData)) {
        if (data) {
          const progressUpdate: Partial<DownloadItem> = {
            progress: data.progress || 0,
            speed: data.speed || "0 KiB/s",
            downloaded_bytes: data.downloaded_bytes || "0 MiB",
            total_bytes: data.total_bytes || "0 MiB",
            eta: data.eta || "unknown",
            status: data.status || "error",
            error: data.error,
          };
          // Use the stable updateDownloadProgress from context
          updateDownloadProgress(id, progressUpdate);

          if (data.status === "error" && data.error?.includes("not found")) {
            console.log(
              `Progress for ${id} not found within batch, likely expired or cancelled.`,
            );
            setTimeout(() => removeDownload(id), 5000);
          }
        }
      }
    } catch (error) {
      console.error(
        `Error during batch polling for ${activeIds.join(", ")}:`,
        error,
      );
      activeIds.forEach((id) =>
        updateDownloadProgress(id, {
          status: "error",
          error: error instanceof Error ? error.message : "Polling failed",
        }),
      );
    }
  }, [updateDownloadProgress, removeDownload]); // Dependencies are stable functions from context

  // Effect to manage the polling interval lifecycle
  useEffect(() => {
    console.log("[ActiveDownloadsList] Interval management useEffect RUNNING");

    // Function to start polling if not already running and active downloads exist
    const startPolling = () => {
      if (
        !pollingIntervalRef.current &&
        downloadsRef.current.some(
          (d) =>
            (d.status === "starting" || d.status === "downloading") &&
            !d.id.startsWith("temp-"),
        )
      ) {
        console.log("Starting polling interval...");
        poll(); // Poll immediately
        pollingIntervalRef.current = setInterval(poll, 1000);
      }
    };

    // Function to stop polling if running
    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        console.log("Stopping polling interval.");
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    // Start polling initially if needed
    startPolling();

    // Cleanup function to stop polling on unmount
    return () => {
      stopPolling();
    };
  }, [poll]); // Re-run only if the stable poll function reference changes (shouldn't)

  // Effect to potentially stop polling if no active downloads remain
  // This runs whenever the main downloads state changes
  useEffect(() => {
    const hasActiveDownloads = downloads.some(
      (d) =>
        (d.status === "starting" || d.status === "downloading") &&
        !d.id.startsWith("temp-"),
    );
    if (!hasActiveDownloads && pollingIntervalRef.current) {
      console.log(
        "Stopping polling interval - no active downloads found in state update.",
      );
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    } else if (hasActiveDownloads && !pollingIntervalRef.current) {
      // If polling stopped but active downloads appeared again, restart it
      console.log(
        "Restarting polling interval - active downloads found in state update.",
      );
      poll(); // Poll immediately
      pollingIntervalRef.current = setInterval(poll, 1000);
    }
  }, [downloads, poll]); // Depend on downloads state and the stable poll function

  if (downloads.length === 0) {
    return null; // Don't render anything if there are no downloads
  }

  return (
    <div className="w-full mt-6 space-y-3">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
          Downloads
        </h2>
        {downloads.length > 0 && (
          <button
            onClick={clearAllDownloads}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 py-1 px-2 rounded"
          >
            Clear All
          </button>
        )}
      </div>
      {downloads.map((download) => (
        <div
          key={download.id}
          className="p-3 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm"
        >
          <div className="flex justify-between items-center mb-2">
            <span
              className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate mr-2"
              title={download.filename}
            >
              {download.filename || "downloading..."}
            </span>
            {/* Show Cancel button only for active downloads */}
            {(download.status === "starting" ||
              download.status === "downloading") && (
              <button
                onClick={() => cancelDownload(download.id)}
                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 ml-2 flex-shrink-0 py-1 px-2 rounded"
                disabled={download.id.startsWith("temp-")} // Disable cancel for pending items
              >
                Cancel
              </button>
            )}
            {/* Optionally add a button to clear completed/errored downloads */}
            {(download.status === "complete" ||
              download.status === "error" ||
              download.status === "cancelled") && (
              <button
                onClick={() => removeDownload(download.id)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ml-2 flex-shrink-0 py-1 px-2 rounded"
              >
                Clear
              </button>
            )}
          </div>
          <ProgressBar
            progress={download.progress}
            stats={{
              speed: download.speed,
              downloaded: download.downloaded_bytes,
              total: download.total_bytes,
              eta: download.eta ?? "unknown",
            }}
            status={mapStatusForProgressBar(download.status)} // Use the mapping function
          />
          {/* Display error message if status is error */}
          {download.status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              Error: {download.error || "Unknown error"}
            </p>
          )}
          {/* Display cancelled message */}
          {download.status === "cancelled" && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
              {download.error || "Download cancelled."}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
