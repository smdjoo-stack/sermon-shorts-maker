// Resolves paths to ffmpeg / ffprobe / yt-dlp binaries.
// ffmpeg-static and ffprobe-static ship prebuilt binaries.
// yt-dlp is downloaded once on first use into ./bin.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import ffmpegPath from "ffmpeg-static";
// @ts-expect-error - ffprobe-static ships no types
import ffprobeStatic from "ffprobe-static";
import YTDlpWrapNs from "yt-dlp-wrap";

// CJS/ESM interop: the class is exported as .default under ESM, but is the
// module itself under some bundlers. Resolve robustly.
const YTDlpWrap: typeof YTDlpWrapNs =
  (YTDlpWrapNs as unknown as { default?: typeof YTDlpWrapNs }).default ?? YTDlpWrapNs;

export const FFMPEG: string = ffmpegPath as unknown as string;
export const FFPROBE: string = (ffprobeStatic as { path: string }).path;

const BIN_DIR = path.join(process.cwd(), "bin");
const YTDLP_PATH = path.join(BIN_DIR, os.platform() === "win32" ? "yt-dlp.exe" : "yt-dlp");

let ytdlpReady: Promise<any> | null = null;

export async function getYtDlp(): Promise<any> {
  if (!ytdlpReady) {
    ytdlpReady = (async () => {
      if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });
      if (!fs.existsSync(YTDLP_PATH)) {
        await YTDlpWrap.downloadFromGithub(YTDLP_PATH);
      }
      return new YTDlpWrap(YTDLP_PATH);
    })();
  }
  return ytdlpReady;
}

// Font dir passed to ffmpeg's subtitles filter (fontsdir).
// Family names are read from the TTF name tables (verified):
//   Pretendard-Bold.ttf      -> family "Pretendard"
//   Pretendard-ExtraBold.ttf -> family "Pretendard ExtraBold"
export const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");
export const TITLE_FONT_NAME = "Pretendard ExtraBold"; // heavy weight for titles
export const SUB_FONT_NAME = "Pretendard"; // bold weight for subtitles
