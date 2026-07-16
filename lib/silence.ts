// Detect silent intervals in the source audio using ffmpeg's silencedetect.
// Used to snap clip boundaries to natural pauses so we don't cut mid-sentence.
// Cached per videoId.

import fs from "node:fs";
import { execFile } from "node:child_process";
import { FFMPEG } from "./binaries";
import { cachePath } from "./storage";

export interface Silence {
  start: number;
  end: number;
}

export async function detectSilence(
  mediaPath: string,
  videoId: string,
  noiseDb = -30,
  minDur = 0.25,
): Promise<Silence[]> {
  const cacheFile = cachePath(`${videoId}.silence.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    } catch {
      /* re-detect */
    }
  }

  const stderr = await new Promise<string>((resolve, reject) => {
    execFile(
      FFMPEG,
      [
        "-hide_banner",
        "-nostats",
        "-i",
        mediaPath,
        "-af",
        `silencedetect=noise=${noiseDb}dB:d=${minDur}`,
        "-f",
        "null",
        "-",
      ],
      { maxBuffer: 64 * 1024 * 1024 },
      (err, _stdout, se) => {
        // silencedetect prints to stderr; non-zero exit is unusual but tolerate
        if (err && !se) return reject(err);
        resolve(se || "");
      },
    );
  });

  const silences: Silence[] = [];
  let pendingStart: number | null = null;
  const startRe = /silence_start:\s*([\d.]+)/;
  const endRe = /silence_end:\s*([\d.]+)/;
  for (const line of stderr.split(/\r?\n/)) {
    const s = startRe.exec(line);
    if (s) {
      pendingStart = parseFloat(s[1]);
      continue;
    }
    const e = endRe.exec(line);
    if (e && pendingStart != null) {
      silences.push({ start: pendingStart, end: parseFloat(e[1]) });
      pendingStart = null;
    }
  }

  fs.writeFileSync(cacheFile, JSON.stringify(silences));
  return silences;
}
