import { NextResponse } from "next/server";
import { VideoQuality } from "@/types";
import youtubedl from 'youtube-dl-exec';
import { getFormatOptions } from "@/utils/videoFormats";
import { ChildProcess } from 'child_process'; // Import ChildProcess type

// Define type for progress state
interface DownloadProgress {
  progress: number;
  speed: string;
  total_bytes: string;
  downloaded_bytes: string;
  status: 'starting' | 'downloading' | 'complete' | 'error' | 'cancelled'; // Added 'cancelled' status
  eta?: string;
  error?: string;
  pid?: number; // Added optional process ID
  process?: ChildProcess; // Store the actual process object
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Configure youtube-dl-exec to use the specified yt-dlp binary path
const ytdlpPath = process.env.YTDLP_PATH;

if (!ytdlpPath) {
    console.error('ERROR: YTDLP_PATH environment variable is not set.');
    // Optionally, throw an error to prevent startup if the path is essential
    // throw new Error('YTDLP_PATH environment variable is required.');
}

const customYoutubeDl = ytdlpPath ? youtubedl.create(ytdlpPath) : youtubedl; // Fallback to default if path is missing

// Define cleanup delay
const PROGRESS_CLEANUP_DELAY_MS = 60000; // 1 minute

// Store download progress for each request
// Use a slightly more complex structure to hold both progress and the process object
interface ProgressEntry {
  progressData: DownloadProgress;
  process?: ChildProcess; // Store the process associated with the download
}
const progressMap = new Map<string, ProgressEntry>();

// Function to schedule cleanup for a download ID
function scheduleProgressCleanup(downloadId: string) {
  setTimeout(() => {
    const entry = progressMap.get(downloadId);
    // Ensure process isn't accidentally kept in memory if cleanup runs before kill
    if (entry) {
        entry.process = undefined; 
    }
    progressMap.delete(downloadId);
    console.log(`Cleaned up progress data for ID: ${downloadId}`);
  }, PROGRESS_CLEANUP_DELAY_MS);
}

async function handler(req: Request) {
  let url: string | null = null;
  let quality: string | null = null;
  let downloadId: string | null = null;
  let filename: string | null = null;
  
  try {
    // Get URL, quality, filename from request
    if (req.method === 'GET') {
      const { searchParams } = new URL(req.url);
      url = searchParams.get('url');
      quality = searchParams.get('quality') || 'medium';
      downloadId = searchParams.get('downloadId');
      filename = searchParams.get('filename');
      
      // Check if this is a progress request
      const progressIdsParam = searchParams.get('progressId');
      if (progressIdsParam) {
        console.log(`Progress request for IDs: ${progressIdsParam}`);
        return handleProgressRequest(progressIdsParam);
      }
    } else {
      const body = await req.json().catch(() => ({}));
      url = body.url;
      quality = body.quality || 'medium';
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
    
    // Removed initial progressMap.set for 'starting' status

    console.log(`Download request for URL: ${url}, quality: ${quality}, ID: ${downloadId}`);
    if (ytdlpPath) {
        console.log('Using yt-dlp binary at:', ytdlpPath);
    } else {
        console.warn('YTDLP_PATH not set, using default yt-dlp bundled with youtube-dl-exec.');
    }
    
    // Return the download ID immediately
    if (req.headers.get('x-request-type') === 'init') {
      // Initialize progress map entry here when init request is confirmed
      if (!progressMap.has(downloadId)) {
         // Initialize with basic progress data, process will be added later
         progressMap.set(downloadId, { 
            progressData: {
               progress: 0,
               speed: '0KiB/s',
               total_bytes: '0MiB',
               downloaded_bytes: '0MiB',
               status: 'starting'
            }
         });
      }
      console.log(`Initializing download with ID: ${downloadId}`);
      return NextResponse.json({ downloadId });
    }
    
    // Start the download process
    const videoStream = new ReadableStream({
      start(controller) {
        const currentDownloadId = downloadId!; // Assert non-null as it's set by now

        // Get format options based on quality
        const formatArgs = getFormatOptions(quality as VideoQuality);
        
        // Convert format options array to object properties for youtube-dl-exec
        const formatOptions: Record<string, any> = {};
        
        // Basic options
        formatOptions.noCheckCertificates = true;
        formatOptions.noWarnings = true;
        formatOptions.preferFreeFormats = true;
        formatOptions.output = '-'; // Output to stdout
        
        // Add Cloudflare bypass option
        formatOptions.extractorArgs = 'generic:impersonate';
        
        // Force MP4 container with compatible codecs
        formatOptions.format = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
        
        // Override with quality-specific format if provided
        if (formatArgs.length >= 2 && formatArgs[0] === '-f') {
          formatOptions.format = formatArgs[1];
        }
        
        // Add headers
        formatOptions.addHeader = [
          'referer:youtube.com',
          'user-agent:Mozilla/5.0 (Linux; Android 12; SM-S906N Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.101 Mobile Safari/537.36',
          'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language: en-US,en;q=0.5',
          'DNT: 1'
        ];
        
        console.log('Executing youtube-dl with options:', formatOptions);
        
        // Execute youtube-dl using the potentially custom instance
        const ytDlp = customYoutubeDl.exec(url as string, formatOptions);

        // Store the process and its PID in the map
        const pid = ytDlp.pid;
        const currentEntry = progressMap.get(currentDownloadId);
        if (currentEntry) {
            currentEntry.process = ytDlp;
            currentEntry.progressData.pid = pid;
            currentEntry.progressData.status = 'downloading'; // Update status when process starts
        } else {
            // Should ideally not happen if init was called first, but handle defensively
            console.error(`Progress entry not found for ID ${currentDownloadId} when starting process.`);
            progressMap.set(currentDownloadId, {
                progressData: {
                    progress: 0, speed: '0KiB/s', total_bytes: '0MiB', downloaded_bytes: '0MiB',
                    status: 'downloading',
                    pid: pid
                },
                process: ytDlp
            });
        }
        console.log(`Started process for ID ${currentDownloadId} with PID: ${pid}`);

        // Flag to track if controller is already closed
        let controllerClosed = false;
        
        // Handle progress events from stderr
        ytDlp.stderr?.on('data', (data: Buffer) => {
          const stderr = data.toString();
          // console.log('yt-dlp stderr:', stderr); // Log full stderr if needed for debugging
          
          const lines = stderr.split('\n');
          let isError = false; // Flag to check if an error was detected in this chunk
          let errorMessage = '';

          for (const line of lines) {
            // Check for explicit ERROR lines first
            if (line.startsWith('ERROR:')) {
              console.error(`yt-dlp ERROR detected for ID ${currentDownloadId}: ${line}`);
              isError = true;
              errorMessage = line.substring(6).trim(); // Get message after 'ERROR:'
              break; // Stop processing lines if a definitive error is found
            }
            
            // Original progress parsing logic
            if (line.includes('[download]') && line.includes('%')) {
              try {
                // Extract progress percentage
                const progressMatch = line.match(/(\d+\.\d+)%/);
                if (progressMatch && progressMatch[1]) {
                  const progress = parseFloat(progressMatch[1]);
                  
                  // Extract speed if available
                  let speed = '0KiB/s';
                  const speedMatch = line.match(/at\s+([\d.]+\w+\/s)/);
                  if (speedMatch && speedMatch[1]) {
                    speed = speedMatch[1];
                  }
                  
                  // Extract size if available
                  let totalSize = '0MiB';
                  const sizeMatch = line.match(/of\s+(~?[\d.]+\w+)/);
                  if (sizeMatch && sizeMatch[1]) {
                    totalSize = sizeMatch[1];
                  }
                  
                  // Extract ETA if available
                  let eta = 'unknown';
                  const etaMatch = line.match(/ETA\s+([\d:]+)/);
                  if (etaMatch && etaMatch[1]) {
                    eta = etaMatch[1];
                  }
                  
                  // Calculate downloaded bytes
                  const downloadedBytes = totalSize !== '0MiB' 
                    ? `${(progress / 100 * parseFloat(totalSize)).toFixed(2)}${totalSize.replace(/[\d.]+/, '')}`
                    : '0MiB';
                  
                  // console.log(`Progress update for ${currentDownloadId}: ${progress}%, speed: ${speed}, size: ${totalSize}, ETA: ${eta}`);
                  
                  // Update progress map only if no error was detected in this chunk
                  if (!isError) {
                     const currentEntry = progressMap.get(currentDownloadId);
                     if (currentEntry && currentEntry.progressData.status !== 'complete' && currentEntry.progressData.status !== 'error' && currentEntry.progressData.status !== 'cancelled') {
                        currentEntry.progressData = {
                           ...currentEntry.progressData,
                           progress,
                           speed,
                           total_bytes: totalSize,
                           downloaded_bytes: downloadedBytes,
                           eta,
                           status: 'downloading'
                        };
                     }
                  }
                }
              } catch (error) {
                console.error('Error parsing progress data:', error);
              }
            }
          } // End for loop

          // If an error was detected in stderr, update progress map and potentially close stream
          if (isError) {
             const currentEntry = progressMap.get(currentDownloadId);
             if (currentEntry) {
                currentEntry.progressData = {
                  ...currentEntry.progressData,
                  progress: currentEntry.progressData.progress ?? 0,
                  speed: currentEntry.progressData.speed ?? '0KiB/s',
                  total_bytes: currentEntry.progressData.total_bytes ?? '0MiB',
                  downloaded_bytes: currentEntry.progressData.downloaded_bytes ?? '0MiB',
                  status: 'error',
                  error: errorMessage || 'yt-dlp processing error'
                };
                currentEntry.process = undefined; // Clear process reference
             } else {
                  // Log error if entry not found
                  console.error(`Progress entry not found for ID ${currentDownloadId} during stderr error.`);
             }
             
             // Attempt to close the stream from the controller side on error
             if (!controllerClosed) {
                controllerClosed = true;
                controller.error(new Error(errorMessage || 'yt-dlp processing error'));
             }
             // Schedule cleanup after setting error status
             scheduleProgressCleanup(currentDownloadId);
          }
        });
        
        // Handle video data from stdout
        ytDlp.stdout?.on('data', (chunk: Buffer) => {
          if (!controllerClosed) {
            controller.enqueue(chunk);
          }
        });
        
        // Handle end of stream
        ytDlp.stdout?.on('end', () => {
          if (!controllerClosed) {
            // Update progress map with completion status
            console.log(`Download complete for ID: ${currentDownloadId}`);
            const finalEntry = progressMap.get(currentDownloadId);
            if (finalEntry) {
               finalEntry.progressData = {
                 ...finalEntry.progressData,
                 progress: 100,
                 speed: '0KiB/s',
                 total_bytes: finalEntry.progressData.total_bytes ?? '0MiB',
                 downloaded_bytes: finalEntry.progressData.total_bytes ?? '0MiB',
                 status: 'complete'
               };
               finalEntry.process = undefined; // Clear process reference
            } else {
                 console.error(`Progress entry not found for ID ${currentDownloadId} on completion.`);
            }
            
            // Schedule cleanup of progress data
            scheduleProgressCleanup(currentDownloadId);
            
            controllerClosed = true;
            controller.close();
          }
        });
        
        // Handle errors (e.g., process spawn error, not stderr runtime errors)
        ytDlp.on('error', (err: Error) => {
          console.error(`Process spawn error for ID ${currentDownloadId}:`, err);
          
          // Update progress map with error status
          const currentEntry = progressMap.get(currentDownloadId);
          if (currentEntry) {
             currentEntry.progressData = {
               ...currentEntry.progressData,
               progress: currentEntry.progressData.progress ?? 0,
               speed: currentEntry.progressData.speed ?? '0KiB/s',
               total_bytes: currentEntry.progressData.total_bytes ?? '0MiB',
               downloaded_bytes: currentEntry.progressData.downloaded_bytes ?? '0MiB',
               status: 'error',
               error: err.message || 'Failed to start download process'
             };
             currentEntry.process = undefined; // Clear process reference
          } else {
               console.error(`Progress entry not found for ID ${currentDownloadId} during process spawn error.`);
          }
          
          if (!controllerClosed) {
             controllerClosed = true;
             controller.error(err);
          }
          // Schedule cleanup after setting error status
          scheduleProgressCleanup(currentDownloadId);
        });
      }
    });

    // Set appropriate headers for video streaming
    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Cache-Control', 'no-cache');
    headers.set('Connection', 'keep-alive');
    headers.set('X-Download-ID', downloadId); // Use original downloadId for header
    if (filename) {
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    }

    return new NextResponse(videoStream, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Download error:', error);
    // If an error happens outside the stream logic (e.g., URL parsing),
    // ensure potential progress entry is marked as error and cleaned up
    if (downloadId && progressMap.has(downloadId)) {
        const currentEntry = progressMap.get(downloadId);
        if (currentEntry) {
           currentEntry.progressData = {
             ...currentEntry.progressData,
             progress: currentEntry.progressData.progress ?? 0,
             speed: currentEntry.progressData.speed ?? '0KiB/s',
             total_bytes: currentEntry.progressData.total_bytes ?? '0MiB',
             downloaded_bytes: currentEntry.progressData.downloaded_bytes ?? '0MiB',
             status: 'error',
             error: error instanceof Error ? error.message : "Server setup error"
           };
           currentEntry.process = undefined; // Clear process reference
        }
        scheduleProgressCleanup(downloadId);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process video" },
      { status: 500 }
    );
  }
}

// Handle progress request (now supports single or multiple IDs)
function handleProgressRequest(progressIdsParam: string) {
  const requestedIds = progressIdsParam.split(',').filter(id => id.trim() !== ''); // Split by comma and remove empty strings
  console.log(`Handling progress request for IDs: ${requestedIds.join(', ')}`);

  const results: Record<string, DownloadProgress | null> = {};
  const defaultNotFound: DownloadProgress = {
      status: 'error',
      error: "Download progress not found or expired",
      progress: 0,
      speed: '0KiB/s',
      total_bytes: '0MiB',
      downloaded_bytes: '0MiB'
  };

  for (const id of requestedIds) {
      const entry = progressMap.get(id);
      results[id] = entry?.progressData || defaultNotFound; // Use found data or the default not found structure
  }

  // If only one ID was requested, return the single object (maintaining previous behavior for single polls if needed)
  // if (requestedIds.length === 1) {
  //     const singleResult = results[requestedIds[0]];
  //     if (singleResult?.status === 'error' && singleResult.error?.includes('not found')) {
  //       return NextResponse.json(singleResult, { status: 404 });
  //     }
  //     return NextResponse.json(singleResult);
  // }

  // Return the map of ID -> progress data for batch requests
  return NextResponse.json(results);
}

// Handle cancellation request
async function handleCancelRequest(req: Request) {
  const { searchParams } = new URL(req.url);
  const downloadId = searchParams.get('downloadId');

  if (!downloadId) {
    return NextResponse.json({ error: "downloadId is required" }, { status: 400 });
  }

  console.log(`Cancellation request for ID: ${downloadId}`);
  const entry = progressMap.get(downloadId);

  if (!entry) {
    console.log(`Cannot cancel: Progress data not found for ID: ${downloadId}`);
    // Already gone or never existed, treat as success (idempotent)
    return NextResponse.json({ message: "Download not found or already cleaned up" }, { status: 200 }); 
  }

  // Kill the process if it exists and seems to be running
  const processToKill = entry.process;
  const pid = entry.progressData?.pid;

  if (processToKill && pid && (entry.progressData.status === 'starting' || entry.progressData.status === 'downloading')) {
    try {
      console.log(`Attempting to kill process with PID: ${pid} for download ID: ${downloadId}`);
      // Use 'SIGTERM' first for graceful shutdown, could use 'SIGKILL' if needed
      process.kill(pid, 'SIGTERM'); 
      entry.progressData.status = 'cancelled';
      entry.progressData.error = 'Download cancelled by user.';
      entry.process = undefined; // Clear process reference
      console.log(`Process ${pid} killed successfully.`);
      // Schedule cleanup now that it's cancelled
      scheduleProgressCleanup(downloadId);
      return NextResponse.json({ message: `Download ${downloadId} cancelled.` }, { status: 200 });
    } catch (killError: any) {
      console.error(`Error killing process ${pid}:`, killError);
      // Update status to error if killing failed unexpectedly
      entry.progressData.status = 'error';
      entry.progressData.error = `Failed to cancel download: ${killError.message}`;
      entry.process = undefined; // Clear process reference
      scheduleProgressCleanup(downloadId); // Still schedule cleanup
      return NextResponse.json({ error: "Failed to kill download process", details: killError.message }, { status: 500 });
    }
  } else if (entry.progressData.status === 'complete' || entry.progressData.status === 'error' || entry.progressData.status === 'cancelled') {
     console.log(`Download ${downloadId} is already in a final state (${entry.progressData.status}).`);
     return NextResponse.json({ message: `Download already in final state: ${entry.progressData.status}` }, { status: 200 });
  } else {
     console.log(`No active process found to kill for download ${downloadId}. PID: ${pid}, Status: ${entry.progressData?.status}`);
     // If status suggests it should be running but process/pid is missing, mark as error
     if (entry.progressData.status === 'starting' || entry.progressData.status === 'downloading') {
         entry.progressData.status = 'error';
         entry.progressData.error = 'Cancellation failed: Process reference missing.';
         entry.process = undefined;
         scheduleProgressCleanup(downloadId);
     }
     return NextResponse.json({ message: "No active process found to cancel." }, { status: 200 });
  }
}

export const GET = handler;
export const POST = handler;
export const DELETE = handleCancelRequest; 