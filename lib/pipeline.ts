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
import { prepareSpeechChunks, cleanupChunks } from "./audio";
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
    progress(0.3, "자막이 없어 음성을 인식하는 중... (조금 더 걸려요)");
    const audioPath = await fetchAudio(url, videoId);
    const chunks = await prepareSpeechChunks(audioPath, videoId);

    // Transcribe chunk by chunk and shift each result back onto the real
    // timeline. One request for the whole recording silently truncates.
    const all: Cue[] = [];
    try {
      for (let i = 0; i < chunks.length; i++) {
        progress(
          0.3 + (i / chunks.length) * 0.2,
          `음성을 인식하는 중... (${i + 1}/${chunks.length})`,
        );
        const buf = fs.readFileSync(chunks[i].file);
        const part = await transcribeAudio(apiKey, buf.toString("base64"), "audio/mpeg");
        for (const c of part) {
          all.push({
            start: c.start + chunks[i].offsetSec,
            end: c.end + chunks[i].offsetSec,
            text: c.text,
          });
        }
      }
    } finally {
      cleanupChunks(chunks);
    }
    cues = all.sort((a, b) => a.start - b.start);
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

  const highlights: Highlight[] = [];
  let rejected = 0;
  for (const h of raw) {
    // The model sometimes points outside the transcript — most often when the
    // transcript is a truncated audio transcription of a long service, so it
    // reasons about a 90-minute video while only ~49 minutes exist. Skip those
    // rather than snapping them to the nearest valid cue.
    const range = cueRangeToSeconds(cues!, h.startCueIdx, h.endCueIdx);
    if (!range) {
      rejected++;
      continue;
    }
    const { startSec, endSec } = correctBoundary(range.rawStart, range.rawEnd, cues!, silences);

    // Second net: even with valid indices, boundary correction can collapse two
    // picks onto the same clip. Showing the user near-duplicates is worse than
    // showing fewer options.
    if (highlights.some((x) => Math.abs(x.startSec - startSec) < 5 && Math.abs(x.endSec - endSec) < 5)) {
      rejected++;
      continue;
    }

    highlights.push({
      id: randomUUID(),
      startSec,
      endSec,
      titleLine1: h.titleLine1,
      titleLine2: h.titleLine2,
      summary: h.summary,
      sectionTitle: h.sectionTitle,
      cues: cuesInRange(cues!, startSec, endSec),
    });
  }

  if (highlights.length === 0) {
    throw new Error(
      hasCaptions
        ? "AI가 고른 구간을 영상에서 찾지 못했습니다. 다시 시도해 주세요."
        : "이 영상은 유튜브 자막이 아직 없어 음성 인식으로 분석했는데, 영상이 길어 끝까지 인식하지 못했습니다.\n" +
          "유튜브에 올린 지 얼마 안 된 영상이면 자막이 생길 때까지 몇 시간 기다렸다가 다시 시도해 주세요.\n" +
          "또는 설교 부분만 잘라 올린 영상을 사용해 주세요.",
    );
  }
  if (rejected > 0) {
    console.warn(`[analyze] 하이라이트 ${rejected}개 버림 (범위 밖이거나 중복), ${highlights.length}개 남음`);
  }

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
