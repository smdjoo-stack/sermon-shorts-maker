// Boundary correction — keep clips from cutting mid-sentence.
//
// Signals, strongest first:
//  1. Cue boundaries: AI selects by cue index, so start/end already land on cue edges.
//  2. Silence snap: pull each boundary to the nearest silence within a window
//     (start -> where speech resumes; end -> where speech stops).
//  3. Padding: small lead-in / lead-out so speech doesn't feel clipped.
//
// Length is clamped to [MIN_SEC, MAX_SEC] by extending/trimming to cue edges.

import type { Cue } from "./types";
import type { Silence } from "./silence";

export const MIN_SEC = 30;
export const MAX_SEC = 120;

const SNAP_WINDOW = 2.0; // seconds to search for a silence
const PAD_IN = 0.3;
const PAD_OUT = 0.5;

function nearestSilenceEdge(
  time: number,
  silences: Silence[],
  edge: "resume" | "stop",
): number | null {
  // edge "resume": we want silence.end near `time` (speech resumes) -> use for clip START
  // edge "stop":   we want silence.start near `time` (speech stops)   -> use for clip END
  let best: number | null = null;
  let bestDist = SNAP_WINDOW;
  for (const s of silences) {
    const point = edge === "resume" ? s.end : s.start;
    const d = Math.abs(point - time);
    if (d <= bestDist) {
      bestDist = d;
      best = point;
    }
  }
  return best;
}

export interface CorrectedBoundary {
  startSec: number;
  endSec: number;
}

export function correctBoundary(
  rawStart: number,
  rawEnd: number,
  cues: Cue[],
  silences: Silence[],
): CorrectedBoundary {
  let start = rawStart;
  let end = rawEnd;

  // 2. silence snap
  const sSnap = nearestSilenceEdge(start, silences, "resume");
  if (sSnap != null) start = sSnap;
  const eSnap = nearestSilenceEdge(end, silences, "stop");
  if (eSnap != null) end = eSnap;

  // 3. padding
  start = Math.max(0, start - PAD_IN);
  end = end + PAD_OUT;

  // 1/length: clamp to [MIN,MAX] by walking cue edges outward/inward
  const dur = end - start;
  if (dur < MIN_SEC) {
    // extend end to the next cue boundary until long enough
    const need = MIN_SEC - dur;
    const cueAfter = cues.find((c) => c.start >= end);
    end += cueAfter ? Math.min(need, cueAfter.end - end + need) : need;
  } else if (dur > MAX_SEC) {
    // trim end back to the last cue boundary that keeps us under MAX
    const target = start + MAX_SEC;
    const cueBefore = [...cues].reverse().find((c) => c.end <= target && c.end > start + MIN_SEC);
    end = cueBefore ? cueBefore.end : target;
  }

  return { startSec: round(start), endSec: round(end) };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// Given cue indices from the AI, produce raw seconds from cue edges.
export function cueRangeToSeconds(cues: Cue[], startIdx: number, endIdx: number) {
  const s = cues[Math.max(0, Math.min(startIdx, cues.length - 1))];
  const e = cues[Math.max(0, Math.min(endIdx, cues.length - 1))];
  return { rawStart: s.start, rawEnd: e.end };
}
