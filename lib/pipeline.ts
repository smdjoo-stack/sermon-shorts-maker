// Orchestration for the analyze phase: captions -> highlights -> boundary correction.

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  extractVideoId,
  fetchMeta,
  fetchCaptions,
  fetchAudio,
  fetchVideo,
} from "./ytdlp";
import { analyzeHighlights } from "./gemini";
import { transcribeAudio } from "./gemini";
import { detectSilence } from "./silence";
import { correctBoundary, cueRangeToSeconds } from "./boundaries";
import { cuesInRange } from "./captions";
import type { AnalyzeResult, Cue, Highlight } from "./types";

type Progress = (p: number, msg?: string) => void;

export async function runAnalyze(
  url: string,
  apiKey: string,
  targetSec: number,
  progress: Progress,
): Promise<AnalyzeResult> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("유효한 유튜브 링크가 아닙니다.");

  progress(0.05, "영상 정보를 가져오는 중...");
  const meta = await fetchMeta(url);

  progress(0.2, "자막을 가져오는 중...");
  let cues = await fetchCaptions(url, videoId);
  let hasCaptions = true;

  if (!cues || cues.length < 5) {
    hasCaptions = false;
    progress(0.35, "자막이 없어 음성을 인식하는 중... (조금 더 걸려요)");
    const audioPath = await fetchAudio(url, videoId);
    const buf = fs.readFileSync(audioPath);
    cues = await transcribeAudio(apiKey, buf.toString("base64"), "audio/mp4");
  }
  if (!cues || cues.length < 3) throw new Error("자막·음성 인식에 실패했습니다.");

  progress(0.55, "AI가 하이라이트를 분석하는 중...");
  const raw = await analyzeHighlights(apiKey, cues, targetSec);

  progress(0.8, "구간 경계를 다듬는 중...");
  // silence detection needs local audio; reuse captions timing primarily,
  // but snap to silence when audio is available (download audio once, cheap).
  let silences: { start: number; end: number }[] = [];
  try {
    const audioPath = await fetchAudio(url, videoId);
    silences = await detectSilence(audioPath, videoId);
  } catch {
    silences = []; // fall back to cue-edge boundaries only
  }

  const highlights: Highlight[] = raw.map((h) => {
    const { rawStart, rawEnd } = cueRangeToSeconds(cues!, h.startCueIdx, h.endCueIdx);
    const { startSec, endSec } = correctBoundary(rawStart, rawEnd, cues!, silences);
    return {
      id: randomUUID(),
      startSec,
      endSec,
      titleLine1: h.titleLine1,
      titleLine2: h.titleLine2,
      summary: h.summary,
      sectionTitle: h.sectionTitle,
      cues: cuesInRange(cues!, startSec, endSec),
    };
  });

  // cache cues for later custom-range / re-render use
  cacheCues(videoId, cues);

  progress(1, "완료");
  return { meta, highlights, hasCaptions };
}

// simple cue cache on disk keyed by videoId
import { cachePath } from "./storage";
export function cacheCues(videoId: string, cues: Cue[]): void {
  fs.writeFileSync(cachePath(`${videoId}.cues.json`), JSON.stringify(cues));
}
export function loadCues(videoId: string): Cue[] | null {
  const p = cachePath(`${videoId}.cues.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export { fetchVideo };
