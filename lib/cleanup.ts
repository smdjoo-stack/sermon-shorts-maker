// Housekeeping for .data — without it the app leaks ~130MB per sermon forever.
//
// What gets deleted is chosen by what it costs to lose:
//   cache/*.mp4|m4a  the source download. ~130MB per sermon and the bulk of the
//                    problem. Re-downloadable, so it goes first.
//   cache/*.json     parsed cues + silence map. ~100KB, but regenerating them
//                    needs YouTube AND a Gemini call. Never deleted — keeping
//                    them means a re-visited sermon is cheap again.
//   tmp/*            scratch (ASS files). Worthless once a render ends.
//   out/*.mp4        the user's finished shorts. Their work, so the timer here
//                    is long: they get two months to download them.
//
// Anything touched in the last 30 minutes is left alone — it may be feeding a
// render right now, and yanking the source file mid-encode would break the job.

import fs from "node:fs";
import path from "node:path";
import { CACHE_DIR, OUT_DIR, TMP_DIR } from "./storage";

const DAY = 24 * 60 * 60 * 1000;

const SOURCE_TTL = 14 * DAY;
const OUT_TTL = 60 * DAY;
const TMP_TTL = 6 * 60 * 60 * 1000;
const IN_USE_GRACE = 30 * 60 * 1000;
const SOURCE_CAP_BYTES = 3 * 1024 * 1024 * 1024; // 3GB of cached video

interface Entry {
  file: string;
  size: number;
  mtime: number;
}

function list(dir: string, match?: RegExp): Entry[] {
  if (!fs.existsSync(dir)) return [];
  const out: Entry[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (match && !match.test(name)) continue;
    const file = path.join(dir, name);
    try {
      const st = fs.statSync(file);
      if (st.isFile()) out.push({ file, size: st.size, mtime: st.mtimeMs });
    } catch {
      /* vanished under us — fine */
    }
  }
  return out;
}

function remove(e: Entry, now: number): number {
  if (now - e.mtime < IN_USE_GRACE) return 0; // possibly in use
  try {
    fs.rmSync(e.file, { force: true });
    return e.size;
  } catch {
    return 0; // locked by ffmpeg or a download — try again next launch
  }
}

export function cleanupData(): { freedBytes: number; removed: number } {
  const now = Date.now();
  let freed = 0;
  let removed = 0;

  const drop = (e: Entry) => {
    const n = remove(e, now);
    if (n) {
      freed += n;
      removed++;
    }
  };

  for (const e of list(TMP_DIR)) if (now - e.mtime > TMP_TTL) drop(e);
  for (const e of list(OUT_DIR, /\.mp4$/i)) if (now - e.mtime > OUT_TTL) drop(e);

  const sources = list(CACHE_DIR, /\.(mp4|m4a)$/i);
  for (const e of sources) if (now - e.mtime > SOURCE_TTL) drop(e);

  // Still over the cap? Drop least-recently-used until under it.
  let alive = sources.filter((e) => fs.existsSync(e.file));
  let total = alive.reduce((n, e) => n + e.size, 0);
  if (total > SOURCE_CAP_BYTES) {
    alive.sort((a, b) => a.mtime - b.mtime); // oldest first
    for (const e of alive) {
      if (total <= SOURCE_CAP_BYTES) break;
      const n = remove(e, now);
      if (n) {
        total -= n;
        freed += n;
        removed++;
      }
    }
  }

  return { freedBytes: freed, removed };
}

// Cache hits return early without writing, so mtime would otherwise record when
// a file was downloaded, not when it was last needed — and a sermon reopened
// every week would still age out. Stamp it on use so the TTL and the LRU cap
// both mean "unused for N days".
export function markUsed(file: string): void {
  try {
    const now = new Date();
    fs.utimesSync(file, now, now);
  } catch {
    /* best effort */
  }
}
