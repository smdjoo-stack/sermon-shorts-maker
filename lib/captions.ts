// Parse YouTube auto-caption VTT (rolling format with inline word timings)
// into a clean word stream, then group into cues.
// Validated against real sermon video rz1AzQZFHFg.

import type { Cue, WordToken } from "./types";

function tc(s: string): number | null {
  const m = /(\d+):(\d+):(\d+)[.,](\d+)/.exec(s);
  if (!m) return null;
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
}

// Extract flat, deduped word tokens with per-word timestamps.
export function parseVttWords(raw: string): WordToken[] {
  const lines = raw.split(/\r?\n/);
  const words: WordToken[] = [];
  let curStart: number | null = null;

  for (const line of lines) {
    const head = /(\d+:\d+:\d+[.,]\d+)\s+-->\s+(\d+:\d+:\d+[.,]\d+)/.exec(line);
    if (head) {
      curStart = tc(head[1]);
      continue;
    }
    if (!line.includes("<c>") && !line.includes("<")) continue;

    // segments split by inline <timestamp> tags; leading segment uses curStart
    const segs = line.split(/<\d+:\d+:\d+[.,]\d+>/);
    const times: (number | null)[] = [curStart];
    const tokenRe = /<(\d+:\d+:\d+[.,]\d+)>/g;
    let mm: RegExpExecArray | null;
    while ((mm = tokenRe.exec(line))) times.push(tc(mm[1]));

    for (let k = 0; k < segs.length; k++) {
      const txt = segs[k].replace(/<\/?c>/g, "").trim();
      const t = times[k];
      if (txt && t != null) words.push({ t, w: txt });
    }
  }

  // dedup consecutive identical (t, w)
  const out: WordToken[] = [];
  for (const x of words) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.t - x.t) < 0.001 && last.w === x.w) continue;
    out.push(x);
  }
  return out;
}

// Group words into cues, breaking at gaps or max length.
export function wordsToCues(words: WordToken[], gap = 1.0, maxWords = 7): Cue[] {
  const cues: (Cue & { _lastWordT: number })[] = [];
  let cur: (Cue & { _lastWordT: number; _n: number }) | null = null;

  for (const w of words) {
    if (!cur) {
      cur = { start: w.t, end: w.t, text: w.w, _lastWordT: w.t, _n: 1 };
      continue;
    }
    const dt = w.t - cur._lastWordT;
    if (dt > gap || cur._n >= maxWords) {
      cues.push(cur);
      cur = { start: w.t, end: w.t, text: w.w, _lastWordT: w.t, _n: 1 };
    } else {
      cur.text += " " + w.w;
      cur._lastWordT = w.t;
      cur._n++;
    }
  }
  if (cur) cues.push(cur);

  // set each cue end to next cue start (clamped) so subtitles don't linger
  for (let i = 0; i < cues.length; i++) {
    const nextStart = i + 1 < cues.length ? cues[i + 1].start : cues[i]._lastWordT + 0.6;
    cues[i].end = Math.min(nextStart, cues[i]._lastWordT + 1.2);
  }
  return cues.map(({ start, end, text }) => ({ start, end, text }));
}

// Plain-text SRT/VTT (no word timings) fallback parser.
export function parsePlainVtt(raw: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = raw.split(/\r?\n\r?\n/);
  for (const b of blocks) {
    const head = /(\d+:\d+:\d+[.,]\d+)\s+-->\s+(\d+:\d+:\d+[.,]\d+)/.exec(b);
    if (!head) continue;
    const start = tc(head[1]);
    const end = tc(head[2]);
    if (start == null || end == null) continue;
    const text = b
      .split(/\r?\n/)
      .filter((l) => !l.includes("-->") && !/^WEBVTT|^Kind:|^Language:|^\d+$/.test(l.trim()))
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

// Cues fully or partially inside [start, end].
export function cuesInRange(cues: Cue[], start: number, end: number): Cue[] {
  return cues.filter((c) => c.end > start && c.start < end);
}
