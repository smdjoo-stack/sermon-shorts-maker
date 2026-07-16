import { NextRequest, NextResponse } from "next/server";
import { createJob, runJob } from "@/lib/jobs";
import { runAnalyze } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const { url, apiKey, targetSec } = await req.json();
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (!url) return NextResponse.json({ error: "링크를 입력하세요." }, { status: 400 });
  if (!key) return NextResponse.json({ error: "Gemini API 키가 필요합니다." }, { status: 400 });

  const job = createJob("analyze");
  runJob(job, (progress) => runAnalyze(url, key, Number(targetSec) || 60, progress));

  return NextResponse.json({ jobId: job.id });
}
