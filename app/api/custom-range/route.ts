import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { loadCues } from "@/lib/pipeline";
import { cuesInRange } from "@/lib/captions";
import { generateTitle } from "@/lib/gemini";
import type { Highlight } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { videoId, startSec, endSec, apiKey } = await req.json();
  const key = apiKey || process.env.GEMINI_API_KEY;
  const cues = loadCues(videoId);
  if (!cues) return NextResponse.json({ error: "자막 캐시가 없습니다. 다시 분석해 주세요." }, { status: 400 });

  const inRange = cuesInRange(cues, Number(startSec), Number(endSec));
  const text = inRange.map((c) => c.text).join(" ");

  let title = { titleLine1: "설교 하이라이트", titleLine2: "", summary: text.slice(0, 60) };
  if (key && text) {
    try {
      title = await generateTitle(key, text);
    } catch {
      /* keep default */
    }
  }

  const highlight: Highlight = {
    id: randomUUID(),
    startSec: Number(startSec),
    endSec: Number(endSec),
    titleLine1: title.titleLine1,
    titleLine2: title.titleLine2,
    summary: title.summary,
    sectionTitle: "직접 추가",
    cues: inRange,
  };
  return NextResponse.json({ highlight });
}
