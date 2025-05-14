import { NextResponse } from "next/server";
import { VideoQuality } from "@/types";
import { dl } from "@/server/ytdlp";
import { getFormatOptions } from "@/utils/videoFormats";
import { ChildProcess } from "child_process";

// progress state
interface DownloadProgress {
  progress: number;
  speed: string;
  total_bytes: string;
  downloaded_bytes: string;
  status: "starting" | "downloading" | "complete" | "error" | "cancelled";
  eta?: string;
  error?: string;
  pid?: number;
  process?: ChildProcess;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROGRESS_CLEANUP_DELAY_MS = 60000; // 1 minute

interface ProgressEntry {
  progressData: DownloadProgress;
  process?: ChildProcess; // Store the process associated with the download
}
const progressMap = new Map<string, ProgressEntry>();

// Function to schedule cleanup for a download ID
function scheduleProgressCleanup(downloadId: string) {
  setTimeout(() => {
    const entry = progressMap.get(downloadId);
    if (entry) {
      entry.process = undefined;
    }
    progressMap.delete(downloadId);
    console.log(`Cleaned up progress data for ID: ${downloadId}`);
  }, PROGRESS_CLEANUP_DELAY_MS);
}

// Helper function to parse yt-dlp stderr for progress and errors
function parseYtDlpStdErr(
  line: string,
  currentDownloadId: string,
): Partial<DownloadProgress> | null {
  if (line.startsWith("ERROR:")) {
    console.error(`yt-dlp ERROR detected for ID ${currentDownloadId}: ${line}`);
    return {
      status: "error",
      error: line.substring(6).trim(),
    };
  }

  if (line.includes("[download]") && line.includes("%")) {
    try {
      const progressMatch = line.match(/(\d+\.\d+)%/);
      let progress = 0;
      if (progressMatch && progressMatch[1]) {
        progress = parseFloat(progressMatch[1]);
      }

      let speed = "0KiB/s";
      const speedMatch = line.match(/at\s+([\d.]+\w+\/s)/);
      if (speedMatch && speedMatch[1]) {
        speed = speedMatch[1];
      }

      let totalSize = "0MiB";
      const sizeMatch = line.match(/of\s+(~?[\d.]+\w+)/);
      if (sizeMatch && sizeMatch[1]) {
        totalSize = sizeMatch[1];
      }

      let eta = "unknown";
      const etaMatch = line.match(/ETA\s+([\d:]+)/);
      if (etaMatch && etaMatch[1]) {
        eta = etaMatch[1];
      }

      // Estimate downloaded bytes (this might not be perfectly accurate for all yt-dlp outputs)
      let downloadedBytes = "0MiB";
      if (totalSize !== "0MiB" && !totalSize.startsWith("~") && progress > 0) {
        // Attempt to parse totalSize (e.g., "100.5MiB")
        const sizeValue = parseFloat(totalSize);
        const sizeUnit = totalSize.match(/[a-zA-Z]+/)?.[0] || "MiB";
        if (!isNaN(sizeValue)) {
          downloadedBytes = `${((progress / 100) * sizeValue).toFixed(2)}${sizeUnit}`;
        }
      }

      return {
        progress,
        speed,
        total_bytes: totalSize.startsWith("~")
          ? totalSize.substring(1)
          : totalSize,
        downloaded_bytes: downloadedBytes,
        eta,
        status: progress === 100 ? "complete" : "downloading",
      };
    } catch (e) {
      console.warn(
        `Could not parse progress line for ID ${currentDownloadId}: ${line}`,
        e,
      );
    }
  }
  return null;
}

// Helper function to prepare yt-dlp execution options
function prepareYtDlpOptions(quality: VideoQuality): Record<string, any> {
  const formatArgs = getFormatOptions(quality);
  const formatOptions: Record<string, any> = {
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true,
    output: "-", // Output to stdout
    extractorArgs: "generic:impersonate",
    // Force MP4 container with compatible codecs as a base
    format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    addHeader: [
      "referer:youtube.com",
      "user-agent:Mozilla/5.0 (Linux; Android 12; SM-S906N Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.101 Mobile Safari/537.36",
      "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language: en-US,en;q=0.5",
      "DNT: 1",
    ],
  };

  // Override with quality-specific format if provided by getFormatOptions
  if (formatArgs.length >= 2 && formatArgs[0] === "-f") {
    formatOptions.format = formatArgs[1];
  }
  return formatOptions;
}

// Helper function to create the video stream and manage the download process
function createVideoStreamAndManageDownload(
  url: string,
  formatOptions: Record<string, any>,
  currentDownloadId: string,
  // progressMap: Map<string, ProgressEntry> // Passed to manage state
): ReadableStream {
  return new ReadableStream({
    start(controller) {
      console.log("Executing youtube-dl with options:", formatOptions);
      const ytDlp = dl.exec(url, formatOptions);

      const pid = ytDlp.pid;
      let currentEntry = progressMap.get(currentDownloadId);
      if (currentEntry) {
        currentEntry.process = ytDlp;
        currentEntry.progressData.pid = pid;
        currentEntry.progressData.status = "downloading";
      } else {
        console.error(
          `Progress entry not found for ID ${currentDownloadId} when starting process.`,
        );
        // Initialize a new entry if somehow missing after init (defensive)
        currentEntry = {
          progressData: {
            progress: 0,
            speed: "0KiB/s",
            total_bytes: "0MiB",
            downloaded_bytes: "0MiB",
            status: "downloading",
            pid: pid,
          },
          process: ytDlp,
        };
        progressMap.set(currentDownloadId, currentEntry);
      }
      console.log(
        `Started process for ID ${currentDownloadId} with PID: ${pid}`,
      );

      let controllerClosed = false;

      ytDlp.stderr?.on("data", (data: Buffer) => {
        const stderr = data.toString();
        const lines = stderr.split("\n");
        for (const line of lines) {
          const progressUpdate = parseYtDlpStdErr(line, currentDownloadId);
          if (progressUpdate) {
            const entryToUpdate = progressMap.get(currentDownloadId);
            if (entryToUpdate) {
              Object.assign(entryToUpdate.progressData, progressUpdate);
              if (progressUpdate.status === "error") {
                console.error(
                  `yt-dlp processing error for ID ${currentDownloadId}: ${progressUpdate.error}`,
                );
                if (!controllerClosed) {
                  controller.error(
                    new Error(
                      progressUpdate.error || "yt-dlp processing error",
                    ),
                  );
                  controllerClosed = true;
                }
                ytDlp.kill();
                scheduleProgressCleanup(currentDownloadId);
                return;
              }
              if (progressUpdate.status === "complete") {
                entryToUpdate.progressData.progress = 100;
              }
            } else {
              console.warn(
                `Progress entry not found for ID ${currentDownloadId} during stderr parsing.`,
              );
            }
          }
        }
      });

      ytDlp.stdout?.on("data", (chunk: Buffer) => {
        if (!controllerClosed) {
          controller.enqueue(chunk);
        }
      });

      ytDlp.stdout?.on("end", () => {
        if (!controllerClosed) {
          console.log(`Download complete for ID: ${currentDownloadId}`);
          const finalEntry = progressMap.get(currentDownloadId);
          if (finalEntry) {
            finalEntry.progressData = {
              ...finalEntry.progressData,
              progress: 100,
              speed: "0KiB/s",
              total_bytes: finalEntry.progressData.total_bytes ?? "0MiB",
              downloaded_bytes: finalEntry.progressData.total_bytes ?? "0MiB", // Should be total_bytes
              status: "complete",
            };
            finalEntry.process = undefined;
          } else {
            console.error(
              `Progress entry not found for ID ${currentDownloadId} on completion.`,
            );
          }
          scheduleProgressCleanup(currentDownloadId);
          controllerClosed = true;
          controller.close();
        }
      });

      ytDlp.on("error", (err: Error) => {
        console.error(`Process spawn error for ID ${currentDownloadId}:`, err);
        const entryOnError = progressMap.get(currentDownloadId);
        if (entryOnError) {
          entryOnError.progressData = {
            ...entryOnError.progressData,
            status: "error",
            error: err.message || "Failed to start download process",
          };
          entryOnError.process = undefined;
        } else {
          console.error(
            `Progress entry not found for ID ${currentDownloadId} during process spawn error.`,
          );
        }
        if (!controllerClosed) {
          controllerClosed = true;
          controller.error(err);
        }
        scheduleProgressCleanup(currentDownloadId);
      });
    },
  });
}

async function handler(req: Request) {
  let url: string | null = null;
  let quality: string | null = null;
  let downloadId: string | null = null;
  let filename: string | null = null;

  try {
    // Get URL, quality, filename from request
    if (req.method === "GET") {
      const { searchParams } = new URL(req.url);
      url = searchParams.get("url");
      quality = searchParams.get("quality") || "medium";
      downloadId = searchParams.get("downloadId");
      filename = searchParams.get("filename");

      // Check if this is a progress request
      const progressIdsParam = searchParams.get("progressId");
      if (progressIdsParam) {
        console.log(`Progress request for IDs: ${progressIdsParam}`);
        return handleProgressRequest(progressIdsParam);
      }
    } else {
      const body = await req.json().catch(() => ({}));
      url = body.url;
      quality = body.quality || "medium";
      downloadId = body.downloadId;
      filename = body.filename;
    }

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Generate a unique ID for this download if not provided
    if (!downloadId) {
      downloadId = Date.now().toString();
    }

    console.log(`Using download ID: ${downloadId}`);

    console.log(
      `Download request for URL: ${url}, quality: ${quality}, ID: ${downloadId}`,
    );

    // Return the download ID immediately
    if (req.headers.get("x-request-type") === "init") {
      // Initialize progress map entry here when init request is confirmed
      if (!progressMap.has(downloadId)) {
        // Initialize with basic progress data, process will be added later
        progressMap.set(downloadId, {
          progressData: {
            progress: 0,
            speed: "0KiB/s",
            total_bytes: "0MiB",
            downloaded_bytes: "0MiB",
            status: "starting",
          },
        });
      }
      console.log(`Initializing download with ID: ${downloadId}`);
      return NextResponse.json({ downloadId });
    }

    // Prepare yt-dlp options
    const formatOptions = prepareYtDlpOptions(quality as VideoQuality);

    // Start the download process by creating the video stream
    const videoStream = createVideoStreamAndManageDownload(
      url as string,
      formatOptions,
      downloadId!,
    );

    const headers = new Headers();
    headers.set("Content-Type", "video/mp4");
    headers.set("Cache-Control", "no-cache");
    headers.set("Connection", "keep-alive");
    headers.set("X-Download-ID", downloadId);
    if (filename) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(filename)}"`,
      );
    }

    return new NextResponse(videoStream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Download error:", error);
    if (downloadId && progressMap.has(downloadId)) {
      const currentEntry = progressMap.get(downloadId);
      if (currentEntry) {
        currentEntry.progressData = {
          ...currentEntry.progressData,
          progress: currentEntry.progressData.progress ?? 0,
          speed: currentEntry.progressData.speed ?? "0KiB/s",
          total_bytes: currentEntry.progressData.total_bytes ?? "0MiB",
          downloaded_bytes:
            currentEntry.progressData.downloaded_bytes ?? "0MiB",
          status: "error",
          error: error instanceof Error ? error.message : "Server setup error",
        };
        currentEntry.process = undefined; // Clear process reference
      }
      scheduleProgressCleanup(downloadId);
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process video",
      },
      { status: 500 },
    );
  }
}

// Handle progress request (now supports single or multiple IDs)
function handleProgressRequest(progressIdsParam: string) {
  const requestedIds = progressIdsParam
    .split(",")
    .filter((id) => id.trim() !== ""); // Split by comma and remove empty strings
  console.log(`Handling progress request for IDs: ${requestedIds.join(", ")}`);

  const results: Record<string, DownloadProgress | null> = {};
  const defaultNotFound: DownloadProgress = {
    status: "error",
    error: "Download progress not found or expired",
    progress: 0,
    speed: "0KiB/s",
    total_bytes: "0MiB",
    downloaded_bytes: "0MiB",
  };

  for (const id of requestedIds) {
    const entry = progressMap.get(id);
    results[id] = entry?.progressData || defaultNotFound; // Use found data or the default not found structure
  }

  // Return the map of ID -> progress data for batch requests
  return NextResponse.json(results);
}

// Handle cancellation request
async function handleCancelRequest(req: Request) {
  const { searchParams } = new URL(req.url);
  const downloadId = searchParams.get("downloadId");

  if (!downloadId) {
    return NextResponse.json(
      { error: "downloadId is required" },
      { status: 400 },
    );
  }

  console.log(`Cancellation request for ID: ${downloadId}`);
  const entry = progressMap.get(downloadId);

  if (!entry) {
    console.log(`Cannot cancel: Progress data not found for ID: ${downloadId}`);
    // Already gone or never existed, treat as success (idempotent)
    return NextResponse.json(
      { message: "Download not found or already cleaned up" },
      { status: 200 },
    );
  }

  // Kill the process if it exists and seems to be running
  const processToKill = entry.process;
  const pid = entry.progressData?.pid;

  if (
    processToKill &&
    pid &&
    (entry.progressData.status === "starting" ||
      entry.progressData.status === "downloading")
  ) {
    try {
      console.log(
        `Attempting to kill process with PID: ${pid} for download ID: ${downloadId}`,
      );
      process.kill(pid, "SIGTERM");
      entry.progressData.status = "cancelled";
      entry.progressData.error = "Download cancelled by user.";
      entry.process = undefined; // Clear process reference
      console.log(`Process ${pid} killed successfully.`);
      // Schedule cleanup now that it's cancelled
      scheduleProgressCleanup(downloadId);
      return NextResponse.json(
        { message: `Download ${downloadId} cancelled.` },
        { status: 200 },
      );
    } catch (killError: any) {
      console.error(`Error killing process ${pid}:`, killError);
      // Update status to error if killing failed unexpectedly
      entry.progressData.status = "error";
      entry.progressData.error = `Failed to cancel download: ${killError.message}`;
      entry.process = undefined; // Clear process reference
      scheduleProgressCleanup(downloadId); // Still schedule cleanup
      return NextResponse.json(
        {
          error: "Failed to kill download process",
          details: killError.message,
        },
        { status: 500 },
      );
    }
  } else if (
    entry.progressData.status === "complete" ||
    entry.progressData.status === "error" ||
    entry.progressData.status === "cancelled"
  ) {
    console.log(
      `Download ${downloadId} is already in a final state (${entry.progressData.status}).`,
    );
    return NextResponse.json(
      {
        message: `Download already in final state: ${entry.progressData.status}`,
      },
      { status: 200 },
    );
  } else {
    console.log(
      `No active process found to kill for download ${downloadId}. PID: ${pid}, Status: ${entry.progressData?.status}`,
    );
    // If status suggests it should be running but process/pid is missing, mark as error
    if (
      entry.progressData.status === "starting" ||
      entry.progressData.status === "downloading"
    ) {
      entry.progressData.status = "error";
      entry.progressData.error =
        "Cancellation failed: Process reference missing.";
      entry.process = undefined;
      scheduleProgressCleanup(downloadId);
    }
    return NextResponse.json(
      { message: "No active process found to cancel." },
      { status: 200 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const DELETE = handleCancelRequest;
