"use client";

import { useState } from "react";
import SetupForm, { type SetupValues } from "@/components/SetupForm";
import HighlightList from "@/components/HighlightList";
import ResultList, { type RenderedItem } from "@/components/ResultList";
import { analyze, renderShort } from "@/lib/client";
import type {
  AnalyzeResult,
  Cue,
  Highlight,
  SubtitleOptions,
  TemplateId,
} from "@/lib/types";

type Step = "setup" | "analyzing" | "select" | "result";

export default function Home() {
  const [step, setStep] = useState<Step>("setup");
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState("");

  const [setup, setSetup] = useState<SetupValues | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [subtitles, setSubtitles] = useState<SubtitleOptions>({
    enabled: true,
    size: "large",
    position: "band",
  });
  const [items, setItems] = useState<RenderedItem[]>([]);

  async function handleAnalyze(v: SetupValues) {
    setSetup(v);
    setError("");
    setStep("analyzing");
    setProgress(0);
    try {
      const res = await analyze(v.url, v.apiKey, v.targetSec, (p, m) => {
        setProgress(p);
        setProgressMsg(m);
      });
      setAnalysis(res);
      setHighlights(res.highlights);
      setStep("select");
    } catch (e) {
      setError(String((e as Error).message));
      setStep("setup");
    }
  }

  async function renderOne(
    h: Highlight,
    v: SetupValues,
    template: TemplateId,
    subs: SubtitleOptions,
  ) {
    const update = (patch: Partial<RenderedItem>) =>
      setItems((prev) => prev.map((it) => (it.highlight.id === h.id ? { ...it, ...patch } : it)));
    try {
      update({ status: "rendering", progress: 0, message: "준비 중..." });
      const out = await renderShort(
        {
          url: v.url,
          videoId: analysis!.meta.videoId,
          highlight: h,
          template,
          subtitles: subs,
        },
        (p, m) => update({ progress: p, message: m }),
      );
      // cache-bust so re-renders refresh the player
      update({ status: "done", url: `${out.url}?t=${Date.now()}`, name: out.name });
    } catch (e) {
      update({ status: "error", error: String((e as Error).message) });
    }
  }

  async function handleCreate(selected: Highlight[]) {
    if (!setup || !analysis) return;
    setItems(
      selected.map((h) => ({ highlight: h, status: "pending", progress: 0, message: "대기 중" })),
    );
    setStep("result");
    // render sequentially (source download is shared/cached; ffmpeg is CPU-bound)
    for (const h of selected) {
      await renderOne(h, setup, setup.template, subtitles);
    }
  }

  async function handleEditSubtitles(highlightId: string, cues: Cue[]) {
    if (!setup) return;
    const item = items.find((it) => it.highlight.id === highlightId);
    if (!item) return;
    const updated: Highlight = { ...item.highlight, cues };
    setItems((prev) =>
      prev.map((it) => (it.highlight.id === highlightId ? { ...it, highlight: updated } : it)),
    );
    setHighlights((prev) => prev.map((h) => (h.id === highlightId ? updated : h)));
    await renderOne(updated, setup, setup.template, subtitles);
  }

  return (
    <main className="min-h-screen bg-ink px-4 py-10 sm:py-16">
      {error && step === "setup" && (
        <div className="mx-auto mb-6 max-w-2xl rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {step === "setup" && <SetupForm onSubmit={handleAnalyze} busy={false} />}

      {step === "analyzing" && (
        <div className="mx-auto max-w-md pt-20 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-line border-t-accent" />
          <h2 className="mt-6 text-xl font-bold">영상에서 쇼츠 구간을 찾는 중...</h2>
          <p className="mt-2 text-muted">{progressMsg}</p>
          <div className="mx-auto mt-5 h-2 w-64 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {step === "select" && analysis && (
        <HighlightList
          highlights={highlights}
          setHighlights={setHighlights}
          videoId={analysis.meta.videoId}
          apiKey={setup?.apiKey || ""}
          subtitles={subtitles}
          setSubtitles={setSubtitles}
          onCreate={handleCreate}
          onBack={() => setStep("setup")}
          busy={false}
        />
      )}

      {step === "result" && (
        <ResultList
          items={items}
          onEditSubtitles={handleEditSubtitles}
          onBack={() => setStep("select")}
        />
      )}
    </main>
  );
}
