import { NextRequest, NextResponse } from "next/server";
import { createJob, runJob } from "@/lib/jobs";
import { fetchVideo } from "@/lib/pipeline";
import { renderHighlight } from "@/lib/render";
import { outUrl } from "@/lib/storage";
import type { RenderRequest, Cue } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RenderRequest & { url: string };
  const { url, videoId, highlight, template, subtitles } = body;
  if (!url || !videoId || !highlight) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const job = createJob("render");
  runJob(job, async (progress) => {
    progress(0.05, "원본 영상을 준비하는 중...");
    const source = await fetchVideo(url, videoId, (p) =>
      progress(0.05 + p * 0.5, "원본 영상을 내려받는 중..."),
    );

    progress(0.6, "쇼츠를 렌더링하는 중...");
    const fit = highlight.fit ?? "crop";
    const outName = `${videoId}_${highlight.id}_${template}_${fit}_${subtitles.enabled ? "sub" : "nosub"}_${subtitles.size}_${subtitles.position}.mp4`;
    await renderHighlight({
      sourcePath: source,
      startSec: highlight.startSec,
      endSec: highlight.endSec,
      template,
      titleLine1: highlight.titleLine1,
      titleLine2: highlight.titleLine2,
      cues: highlight.cues as Cue[],
      subtitles,
      fit,
      outName,
      onProgress: (p) => progress(0.6 + p * 0.4, "쇼츠를 렌더링하는 중..."),
    });

    return { url: outUrl(outName), name: outName };
  });

  return NextResponse.json({ jobId: job.id });
}
