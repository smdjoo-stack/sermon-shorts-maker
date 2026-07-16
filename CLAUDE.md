# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Korean-language web app: paste a sermon YouTube link → AI picks 5–6 highlight segments → renders them as 1080×1920 shorts with burned-in subtitles. UI text is Korean; keep it that way.

## Commands

```bash
npm run dev      # dev server on port 3939
npm run build    # production build
npx tsc --noEmit # typecheck — the only static check that exists
```

There is **no test suite and no linter**. (`npm run lint` is a dead script: Next 16 removed `next lint`, so it fails parsing "lint" as a directory.) Verification is done by running the real pipeline and inspecting output — see "Verifying changes".

## Architecture

### A Node server is mandatory

Downloading and editing video can't happen in a browser. `yt-dlp` and `ffmpeg` binaries are spawned from API routes. This rules out serverless (Vercel): deployment needs a long-running Node server with a disk. Cloud IPs are also frequently blocked by YouTube.

### The pipeline, and why it's built this way

`app/page.tsx` drives four steps (setup → analyzing → select → result) against job-polling API routes. The real work:

**Analyze** (`lib/pipeline.ts` `runAnalyze`) — the load-bearing design decision is that **the AI never sees the video**. It reads YouTube's auto-caption text only. This is faster, cheaper, and gives frame-accurate timestamps. Uploading video would only get you "around 7 minutes-ish" and you could never sync subtitles to it.

1. `lib/ytdlp.ts` fetches metadata + Korean auto-caption VTT.
2. `lib/captions.ts` parses it. **YouTube auto-captions carry per-word timestamps** (`<00:00:03.679><c>단어</c>`) — this is the highest-precision signal in the system. The format is "rolling" (each cue repeats the previous line), so the parser flattens to a deduped word stream, then regroups into cues.
3. `lib/gemini.ts` runs **two passes**: first extract the sermon's structure (central message, 대지/sections), then pick highlights *given that structure*. One pass alone grabs a punchy sentence with no surrounding context and the clip makes no sense.
4. `lib/boundaries.ts` + `lib/silence.ts` correct the edges (see below).
5. Cues are cached to disk so re-renders and custom ranges don't re-fetch.

**Render** (`lib/render.ts`) — cut → fit into the video band → composite onto the canvas → burn one ASS file containing *both* title and subtitles in a single `subtitles` filter pass.

### Not cutting mid-sentence

This is a primary product requirement, defended in three layers because none alone is sufficient:

1. **Gemini returns cue *indices*, not seconds** (`lib/gemini.ts`). Free-form seconds land in the middle of a cue, which is a mid-word cut by construction. Indices guarantee cue-edge boundaries.
2. **Silence snap** (`lib/boundaries.ts`). Korean auto-captions have **no punctuation**, so you cannot find sentence ends by looking for periods. Speakers breathe between sentences, so `ffmpeg silencedetect` output is the physical evidence of a sentence boundary. Each edge pulls to the nearest silence within ±2s.
3. **Manual nudge** in the UI — moves edges cue-by-cue as a last resort.

Length is clamped to 30–120s, adjusted only along cue edges.

### Layout constants are measured, not invented

`lib/layout.ts` is the single source of truth for geometry and is **derived from pixel measurements of two sample videos the user supplied** (one dark, one light). Those samples are not in the repo — the measurements below are the surviving record of them. Canvas splits exactly 25/50/25:

| band | y | height |
|---|---|---|
| title | 0–479 | 480 |
| video | 480–1439 | 960 (1080×960 = 9:8) |
| subtitle | 1440–1919 | 480 |

Both samples matched these boundaries to the pixel — the grid is intentional, not incidental. **Don't eyeball changes here.** Templates (`dark`/`light`) differ only in color; layout is shared. Title line 2 is always the accent color, so prompts must split titles with the emphasis on line 2.

`VideoFit` (`crop` | `contain`) is per-highlight: `crop` center-crops to fill (good for a centered preacher), `contain` letterboxes with the template bg (good when slides/PPT are on screen and would be cut).

The workflow was modelled on screenshots of an existing app, which are deliberately **not** in this repo. The UI here is an original design, not a copy — keep it that way.

## Gotchas that will silently break things

- **`--ffmpeg-location` is required** for `yt-dlp` (`lib/ytdlp.ts`). System ffmpeg isn't installed; yt-dlp needs it to merge separate video+audio streams. Without it the download "succeeds" but leaves `.f398.mp4`/`.f140.m4a` fragments and no final mp4.
- **The job store must live on `globalThis`** (`lib/jobs.ts`). Next bundles each route separately, so a module-level `Map` gives `/api/render` and `/api/jobs` *different instances* — jobs get created then 404 on poll.
- **Font family names differ per weight**: `Pretendard-Bold.ttf` → family `Pretendard`; `Pretendard-ExtraBold.ttf` → family `Pretendard ExtraBold`. ASS matches on family name; get it wrong and Korean silently falls back to tofu. Fonts are bundled twice on purpose: `assets/fonts/` (server, for ffmpeg `fontsdir`) and `public/fonts/` (browser UI). Never rely on system fonts — Linux deploy would break.
- **ASS `WrapStyle` must be `0`** (`lib/ass.ts`). `2` disables auto-wrap and long subtitles run off both screen edges.
- **Gemini models are tried in a candidate chain** (`lib/gemini.ts`), because a given key may be denied both new and old models ("no longer available to new users"). Transient 503/429 retries with backoff before falling through. Override with `GEMINI_MODEL`.

## Caching (`.data/`, gitignored)

Source video is downloaded **once per `videoId`** and reused across all 5–6 clips — never re-download per clip. Silence detection and cues are cached alongside. `bin/` holds the auto-downloaded yt-dlp binary.

## API key handling

The key comes from the browser (`localStorage`), is sent per-request, and used only in memory. **Never write it to disk.** `.env.local`'s `GEMINI_API_KEY` is a local-dev fallback only.

## Verifying changes

There are no tests; verify by observing real behavior.

- **Render changes**: render a clip, extract a frame (`ffmpeg -ss N -i out.mp4 -vframes 1 f.png`), and *look at it*. To check geometry precisely, decode to raw RGB and scan rows for band boundaries rather than trusting your eyes — that's how `lib/layout.ts` was derived, and how a regression in it should be caught.
- **Pipeline plumbing** can be exercised without a valid Gemini key: `POST /api/analyze` with a dummy key reaches ~55% (metadata + captions succeed) and fails only at the Gemini call. Getting that far proves everything except the AI itself.
- **Full render without AI**: `POST /api/custom-range` (uses cached cues, tolerates a missing key) to build a highlight, then `POST /api/render` and poll `/api/jobs/<id>`.
- Korean text must be checked visually for tofu (□□□); a successful exit code proves nothing about glyph rendering.

## Legal framing

YouTube downloading is a gray area. The app is built on the premise of the user's own church's sermons and states this in the UI. Keep that notice.
