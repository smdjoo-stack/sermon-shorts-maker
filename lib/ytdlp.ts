// yt-dlp operations: metadata, caption download, cached video download.

import fs from "node:fs";
import path from "node:path";
import { getYtDlp, FFMPEG } from "./binaries";

// Directory of the bundled ffmpeg — yt-dlp needs it to merge separate
// video+audio streams (system ffmpeg is not installed).
const FFMPEG_DIR = path.dirname(FFMPEG);
import { cachePath, tmpPath } from "./storage";
import { markUsed } from "./cleanup";
import {
  parseVttWords,
  wordsToCues,
  parsePlainVtt,
} from "./captions";
import type { Cue, VideoMeta } from "./types";

export function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = p.exec(url);
    if (m) return m[1];
  }
  // bare id
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

export async function fetchMeta(url: string): Promise<VideoMeta> {
  const yt = await getYtDlp();
  const out: string = await yt.execPromise([
    url,
    "--skip-download",
    "--no-warnings",
    "--print",
    "%(id)s|||%(title)s|||%(duration)s",
  ]);
  const [videoId, title, duration] = out.trim().split("|||");
  return { videoId, title, durationSec: Number(duration) || 0 };
}

// Download Korean auto-captions, return parsed cues. null if none.
export async function fetchCaptions(url: string, videoId: string): Promise<Cue[] | null> {
  const yt = await getYtDlp();
  const base = tmpPath(`cap_${videoId}`);
  // clean stale
  for (const f of fs.readdirSync(path.dirname(base))) {
    if (f.startsWith(`cap_${videoId}`)) fs.rmSync(path.join(path.dirname(base), f), { force: true });
  }
  try {
    await yt.execPromise([
      url,
      "--skip-download",
      "--write-auto-subs",
      "--write-subs",
      "--sub-langs",
      "ko,ko-KR,ko-orig",
      "--sub-format",
      "vtt",
      "--no-warnings",
      "-o",
      base,
    ]);
  } catch {
    // fall through — file check below
  }

  const dir = path.dirname(base);
  const vtt = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`cap_${videoId}`) && f.endsWith(".vtt"))
    .map((f) => path.join(dir, f))[0];

  if (!vtt) return null;
  const raw = fs.readFileSync(vtt, "utf8");
  fs.rmSync(vtt, { force: true });

  // Prefer word-level parsing; fall back to plain cues if no inline timings.
  const words = parseVttWords(raw);
  if (words.length > 20) return wordsToCues(words);
  const plain = parsePlainVtt(raw);
  return plain.length ? plain : null;
}

// Download audio only (for the Gemini transcription fallback), cached.
export async function fetchAudio(url: string, videoId: string): Promise<string> {
  const dest = cachePath(`${videoId}.m4a`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    markUsed(dest); // keep the cleanup TTL measured from last use, not download
    return dest;
  }
  const yt = await getYtDlp();
  await yt.execPromise([
    url,
    "-f",
    "bestaudio[ext=m4a]/bestaudio",
    "--ffmpeg-location",
    FFMPEG_DIR,
    "--no-warnings",
    "-o",
    dest,
  ]);
  return dest;
}

// Download the source video once, cached by videoId (<=720p mp4).
export async function fetchVideo(
  url: string,
  videoId: string,
  onProgress?: (p: number) => void,
): Promise<string> {
  const dest = cachePath(`${videoId}.mp4`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    markUsed(dest);
    return dest;
  }

  const yt = await getYtDlp();
  await new Promise<void>((resolve, reject) => {
    const ev = yt.exec([
      url,
      "-f",
      "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
      "--merge-output-format",
      "mp4",
      "--ffmpeg-location",
      FFMPEG_DIR,
      "--no-warnings",
      "-o",
      dest,
    ]);
    ev.on("progress", (p: { percent?: number }) => {
      if (onProgress && typeof p.percent === "number") onProgress(p.percent / 100);
    });
    ev.on("error", reject);
    ev.on("close", () => resolve());
  });
  return dest;
}
