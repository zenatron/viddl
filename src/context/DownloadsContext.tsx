"use client";
import React, {
  createContext,
  useState,
  useCallback,
  useContext,
  ReactNode,
} from "react";
import { VideoQuality } from "@/types";

// Define the structure for a single download item
export interface DownloadItem {
  id: string; // Corresponds to downloadId from the backend
  filename: string;
  quality: VideoQuality;
  url: string; // The original video URL
  progress: number;
  speed: string;
  total_bytes: string;
  downloaded_bytes: string;
  status:
    | "starting"
    | "downloading"
    | "complete"
    | "error"
    | "cancelled"
    | "pending"; // Added 'pending' for items added before init response
  eta?: string;
  error?: string;
}

// Define the shape of the context data
interface DownloadsContextType {
  downloads: DownloadItem[];
  addDownload: (
    item: Omit<
      DownloadItem,
      | "id"
      | "status"
      | "progress"
      | "speed"
      | "total_bytes"
      | "downloaded_bytes"
    >,
  ) => Promise<void>; // Takes basic info, gets ID from backend
  updateDownloadProgress: (
    id: string,
    progressData: Partial<DownloadItem>,
  ) => void;
  removeDownload: (id: string) => void;
  cancelDownload: (id: string) => Promise<void>;
  clearAllDownloads: () => void; // Added to clear all downloads
}

// Create the context with a default value
const DownloadsContext = createContext<DownloadsContextType | undefined>(
  undefined,
);

// Define props for the provider component
interface DownloadsProviderProps {
  children: ReactNode;
}

// Create the provider component
export const DownloadsProvider: React.FC<DownloadsProviderProps> = ({
  children,
}) => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

  // Function to add a new download
  const addDownload = useCallback(
    async (
      itemInfo: Omit<
        DownloadItem,
        | "id"
        | "status"
        | "progress"
        | "speed"
        | "total_bytes"
        | "downloaded_bytes"
      >,
    ) => {
      // Temporary ID while we wait for backend init
      const tempId = `temp-${Date.now()}`;
      const newItem: DownloadItem = {
        ...itemInfo,
        id: tempId,
        status: "pending",
        progress: 0,
        speed: "0 KiB/s",
        total_bytes: "0 MiB",
        downloaded_bytes: "0 MiB",
      };
      setDownloads((prev) => [...prev, newItem]);

      try {
        console.log("Initializing download for:", itemInfo.url);
        const initResponse = await fetch(
          `/api/download?url=${encodeURIComponent(itemInfo.url)}&quality=${itemInfo.quality}`,
          {
            headers: {
              "X-Request-Type": "init",
            },
          },
        );

        if (!initResponse.ok) {
          const errorData = await initResponse.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Download initialization failed with status: ${initResponse.status}`,
          );
        }

        const { downloadId } = await initResponse.json();
        console.log("Received download ID:", downloadId);

        if (!downloadId) {
          throw new Error("Backend did not return a download ID.");
        }

        // Update the item with the real ID and set status to starting
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === tempId ? { ...d, id: downloadId, status: "starting" } : d,
          ),
        );

        // Now trigger the actual browser download
        let baseFilename = itemInfo.filename.replace(
          /[^a-zA-Z0-9\s_\-\.]/g,
          "_",
        );
        // Remove leading/trailing dots and ensure it's not empty or just dots
        baseFilename = baseFilename.replace(/^\.+|\.+$/g, "").trim();
        if (!baseFilename || /^\.*$/.test(baseFilename)) {
          baseFilename = "viddl-download";
        }
        const safeFilename = `${baseFilename}.mp4`;

        const downloadUrl = `/api/download?url=${encodeURIComponent(itemInfo.url)}&quality=${itemInfo.quality}&downloadId=${downloadId}&filename=${encodeURIComponent(safeFilename)}`;

        const downloadLink = document.createElement("a");
        downloadLink.href = downloadUrl;
        downloadLink.download = safeFilename;
        downloadLink.click();
        console.log("Browser download initiated for:", downloadUrl);

        // Note: Polling will be handled elsewhere (ActiveDownloadsList)
      } catch (error) {
        console.error("Failed to initiate download:", error);
        // Update the temporary item to show an error
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === tempId
              ? {
                  ...d,
                  status: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Initialization failed",
                }
              : d,
          ),
        );
        // Optionally remove after a delay or let user clear it
        setTimeout(() => removeDownload(tempId), 60000);
      }
    },
    [],
  );

  // Function to update progress/status of a download
  const updateDownloadProgress = useCallback(
    (id: string, progressData: Partial<DownloadItem>) => {
      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...progressData } : d)),
      );
    },
    [],
  );

  // Function to remove a download (e.g., after completion/error timeout or user action)
  const removeDownload = useCallback((id: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // Function to clear all downloads
  const clearAllDownloads = useCallback(() => {
    // Before clearing, we might want to attempt to cancel any active downloads
    // to inform the backend, though this example directly clears the UI.
    // For a more robust solution, iterate and call cancelDownload for active ones.
    downloads.forEach(download => {
      if (download.status === "downloading" || download.status === "starting") {
        // We don't await these, just fire and forget for cleanup
        // The backend should handle cleanup of its resources eventually
        fetch(`/api/download?downloadId=${download.id}`, { method: "DELETE" })
          .then(response => {
            if (!response.ok) {
              console.warn(`Attempt to cancel ${download.id} during clearAll failed.`);
            } else {
              console.log(`Sent cancel request for ${download.id} during clearAll.`);
            }
          })
          .catch(error => {
            console.error(`Error sending cancel request for ${download.id} during clearAll:`, error);
          });
      }
    });
    setDownloads([]);
    console.log("All downloads cleared from UI.");
  }, [downloads]); // Add downloads to dependency array

  // Function to cancel a download
  const cancelDownload = useCallback(
    async (id: string) => {
      const download = downloads.find((d) => d.id === id);
      if (
        !download ||
        download.status === "pending" ||
        download.status === "complete" ||
        download.status === "error" ||
        download.status === "cancelled"
      ) {
        console.log(
          `Download ${id} not cancellable (status: ${download?.status})`,
        );
        return;
      }

      // Optimistically update UI
      updateDownloadProgress(id, {
        status: "cancelled",
        error: "Cancelling...",
      });

      try {
        console.log(`Sending cancel request for download ID: ${id}`);
        const response = await fetch(`/api/download?downloadId=${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Cancellation failed with status: ${response.status}`,
          );
        }

        // Backend confirms cancellation, update status definitively
        // Polling will eventually pick this up too, but this makes the UI immediate
        const result = await response.json();
        updateDownloadProgress(id, {
          status: "cancelled",
          error: result.message || "Download cancelled by user.",
        });
        console.log(`Cancellation successful for ${id}:`, result.message);
        // The cleanup timer is handled by the backend
      } catch (error) {
        console.error(`Failed to cancel download ${id}:`, error);
        // Revert optimistic update or set specific error
        updateDownloadProgress(id, {
          status: "error", // Set to error if cancellation fails
          error: error instanceof Error ? error.message : "Cancellation failed",
        });
      }
    },
    [downloads, updateDownloadProgress],
  );

  return (
    <DownloadsContext.Provider
      value={{
        downloads,
        addDownload,
        updateDownloadProgress,
        removeDownload,
        cancelDownload,
        clearAllDownloads,
      }}
    >
      {children}
    </DownloadsContext.Provider>
  );
};

// Custom hook to use the DownloadsContext
export const useDownloads = (): DownloadsContextType => {
  const context = useContext(DownloadsContext);
  if (context === undefined) {
    throw new Error("useDownloads must be used within a DownloadsProvider");
  }
  return context;
};
