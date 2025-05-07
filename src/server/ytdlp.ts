import youtubedl from "youtube-dl-exec";

// Configure youtube-dl-exec to use the system-installed yt-dlp binary
const ytdlpPath = process.env.YTDLP_PATH as string;

if (!ytdlpPath) {
  console.error("CRITICAL: YTDLP_PATH environment variable is not set. This application may not function correctly.");
  // throw new Error("YTDLP_PATH environment variable is required for server operations."); // Option: Hard fail
}

export const customYoutubeDl = ytdlpPath 
  ? youtubedl.create(ytdlpPath) 
  : (() => {
      console.error("CRITICAL: YTDLP_PATH not set. Using a non-functional youtube-dl wrapper. Downloads will likely fail.");
      // Return a dummy object that will throw errors if its methods are called
      return {
        exec: () => Promise.reject(new Error("yt-dlp path not configured")) as any,
        // Add other methods if they are directly called from youtubeDl.METHOD()
      };
    })();

// Common options for all yt-dlp commands
const commonOptions = {
  noPlaylist: true,
  noCheckCertificates: true,
  noWarnings: true,
  preferFreeFormats: true,
  // Use type assertion for extractorArgs
  ...({ extractorArgs: "generic:impersonate" } as any),
  addHeader: [
    "referer:youtube.com",
    "user-agent:Mozilla/5.0 (Linux; Android 12; SM-S906N Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.101 Mobile Safari/537.36",
    "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language: en-US,en;q=0.5",
    "DNT: 1",
  ],
};

// Function to list available formats
export async function listVideoFormats(url: string): Promise<string> {
  console.log(`Listing formats for ${url}...`);

  try {
    const result = await customYoutubeDl.exec(url, {
      ...commonOptions,
      listFormats: true,
    });

    console.log("Available formats:");
    console.log(result.stdout);

    return result.stdout;
  } catch (error) {
    console.error("Error listing formats:", error);
    return "Error listing formats";
  }
}

export async function getVideoMetadata(url: string) {
  console.log(`Fetching metadata for URL: ${url}`);
  console.log("Using yt-dlp binary at:", ytdlpPath);

  try {
    // Use exec instead of direct call for more control
    const { stdout, stderr } = await customYoutubeDl.exec(url, {
      ...commonOptions,
      dumpSingleJson: true,
    });

    console.log("youtube-dl stdout length:", stdout?.length || 0);
    console.log("youtube-dl stderr:", stderr);

    if (!stdout) {
      throw new Error("No output from youtube-dl");
    }

    try {
      // Parse the JSON output
      const result = JSON.parse(stdout);
      return result;
    } catch (parseError) {
      console.error("Error parsing youtube-dl output:", parseError);
      console.error("Raw output:", stdout.substring(0, 200) + "...");
      throw new Error("Failed to parse video metadata");
    }
  } catch (error) {
    console.error("yt-dlp detailed error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw new Error("Failed to process video");
  }
}
