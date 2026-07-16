"use client";

import { useState } from "react";
import type {
  Highlight,
  SubtitleOptions,
  SubtitleSize,
  SubtitlePosition,
  VideoFit,
} from "@/lib/types";
import { mmss, durLabel, parseTime } from "@/lib/format";
import { addCustomRange } from "@/lib/client";

const SIZE_LABEL: Record<SubtitleSize, string> = {
  small: "작게",
  medium: "보통",
  large: "크게",
  xlarge: "아주 크게",
};
const POS_LABEL: Record<SubtitlePosition, string> = {
  band: "하단 자막칸",
  "video-under": "영상 바로 아래",
  "video-bottom": "영상 안 하단",
  "screen-bottom": "화면 맨 아래",
};

export default function HighlightList({
  highlights,
  setHighlights,
  videoId,
  apiKey,
  subtitles,
  setSubtitles,
  onCreate,
  onBack,
  busy,
}: {
  highlights: Highlight[];
  setHighlights: (h: Highlight[]) => void;
  videoId: string;
  apiKey: string;
  subtitles: SubtitleOptions;
  setSubtitles: (s: SubtitleOptions) => void;
  onCreate: (selected: Highlight[]) => void;
  onBack: () => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<{ startSec: number; endSec?: number; label: string } | null>(
    null,
  );

  function toggle(id: string) {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  }

  function editField(id: string, field: "titleLine1" | "titleLine2", value: string) {
    setHighlights(highlights.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  }

  function setFit(id: string, fit: VideoFit) {
    setHighlights(highlights.map((h) => (h.id === id ? { ...h, fit } : h)));
  }

  // nudge start/end by one cue
  function nudge(id: string, edge: "start" | "end", dir: -1 | 1) {
    setHighlights(
      highlights.map((h) => {
        if (h.id !== id) return h;
        if (h.cues.length === 0) return h;
        if (edge === "start") {
          // move start to previous/next cue boundary
          const candidates = h.cues.map((c) => c.start);
          const next = pickNeighbor(candidates, h.startSec, dir);
          if (next == null || next >= h.endSec - 5) return h;
          return { ...h, startSec: Math.max(0, next) };
        } else {
          const candidates = h.cues.map((c) => c.end);
          const next = pickNeighbor(candidates, h.endSec, dir);
          if (next == null || next <= h.startSec + 5) return h;
          return { ...h, endSec: next };
        }
      }),
    );
  }

  async function addCustom() {
    setErr("");
    const s = parseTime(customStart);
    const e = parseTime(customEnd);
    if (s == null || e == null || e <= s) {
      setErr("시작·끝 시간을 올바르게 입력하세요. (예: 1:30)");
      return;
    }
    setAdding(true);
    try {
      const h = await addCustomRange({ videoId, startSec: s, endSec: e, apiKey });
      setHighlights([...highlights, h]);
      setCustomStart("");
      setCustomEnd("");
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setAdding(false);
    }
  }

  const selectedList = highlights.filter((h) => selected.has(h.id));

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6">
        <button onClick={onBack} className="text-sm text-muted hover:text-white">
          ← 다른 링크로 다시
        </button>
        <h2 className="mt-2 text-2xl font-extrabold">쇼츠로 만들 구간을 골라주세요</h2>
        <p className="mt-1 text-muted">
          추천 구간을 고르거나, 원하는 구간을 직접 추가해 한 번에 만들 수 있어요.
        </p>
      </div>

      {/* custom range */}
      <div className="mb-6 rounded-2xl border border-dashed border-line bg-panel/60 p-4">
        <div className="mb-3 font-bold text-accent">＋ 원하는 구간 직접 추가</div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            placeholder="시작 0:45"
            className="input max-w-[140px]"
          />
          <span className="text-muted">–</span>
          <input
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            placeholder="끝 1:30"
            className="input max-w-[140px]"
          />
          <button
            onClick={addCustom}
            disabled={adding}
            className="rounded-xl bg-panel2 border border-line px-5 py-3 font-bold hover:border-accent disabled:opacity-40"
          >
            {adding ? "추가 중..." : "이 구간 추가"}
          </button>
          <button
            onClick={() => {
              const s = parseTime(customStart);
              if (s == null) {
                setErr("미리보기할 시작 시간을 입력하세요. (예: 0:45)");
                return;
              }
              setErr("");
              setPreview({ startSec: s, endSec: parseTime(customEnd) ?? undefined, label: "직접 입력 구간" });
            }}
            className="rounded-xl px-4 py-3 text-sm font-bold text-accent hover:bg-accent/10"
          >
            ▶ 미리보기
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
      </div>

      {/* cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {highlights.map((h) => (
          <Card
            key={h.id}
            h={h}
            checked={selected.has(h.id)}
            onToggle={() => toggle(h.id)}
            onEdit={editField}
            onNudge={nudge}
            onSetFit={setFit}
            onPreview={() =>
              setPreview({
                startSec: h.startSec,
                endSec: h.endSec,
                label: `${h.titleLine1} ${h.titleLine2}`.trim(),
              })
            }
          />
        ))}
      </div>

      {/* subtitle options */}
      <div className="mt-8 rounded-2xl border border-line bg-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-bold">자막 설정</span>
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-sm text-muted">자막 넣기</span>
            <input
              type="checkbox"
              checked={subtitles.enabled}
              onChange={(e) => setSubtitles({ ...subtitles, enabled: e.target.checked })}
              className="h-5 w-5 accent-[var(--tw-accent,#f5c518)]"
              style={{ accentColor: "#f5c518" }}
            />
          </label>
        </div>
        {subtitles.enabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-sm text-muted">크기</div>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(SIZE_LABEL) as SubtitleSize[]).map((s) => (
                  <Chip
                    key={s}
                    active={subtitles.size === s}
                    onClick={() => setSubtitles({ ...subtitles, size: s })}
                  >
                    {SIZE_LABEL[s]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm text-muted">위치</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(POS_LABEL) as SubtitlePosition[]).map((p) => (
                  <Chip
                    key={p}
                    active={subtitles.position === p}
                    onClick={() => setSubtitles({ ...subtitles, position: p })}
                  >
                    {POS_LABEL[p]}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* create bar */}
      <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-2xl border border-line bg-panel/95 p-4 backdrop-blur">
        <span className="font-bold">{selected.size}개 선택됨</span>
        <button
          onClick={() => onCreate(selectedList)}
          disabled={busy || selected.size === 0}
          className="rounded-xl bg-accent px-6 py-3 font-extrabold text-black transition hover:bg-accent2 disabled:opacity-40"
        >
          {busy ? "만드는 중..." : `${selected.size}개 만들기`}
        </button>
      </div>

      {preview && (
        <PreviewModal
          videoId={videoId}
          startSec={preview.startSec}
          endSec={preview.endSec}
          label={preview.label}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

function PreviewModal({
  videoId,
  startSec,
  endSec,
  label,
  onClose,
}: {
  videoId: string;
  startSec: number;
  endSec?: number;
  label: string;
  onClose: () => void;
}) {
  const src =
    `https://www.youtube.com/embed/${videoId}` +
    `?start=${Math.floor(startSec)}` +
    (endSec ? `&end=${Math.ceil(endSec)}` : "") +
    `&autoplay=1&rel=0`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="min-w-0">
            <div className="truncate font-bold">{label}</div>
            <div className="text-xs text-muted">
              {mmss(startSec)}
              {endSec ? ` – ${mmss(endSec)}` : ""} 구간 · 원본 영상에서 재생됩니다
            </div>
          </div>
          <button onClick={onClose} className="ml-4 flex-shrink-0 text-muted hover:text-white">
            ✕ 닫기
          </button>
        </div>
        <div className="aspect-video w-full bg-black">
          <iframe
            src={src}
            title="구간 미리보기"
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

function pickNeighbor(values: number[], current: number, dir: -1 | 1): number | null {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  if (dir === -1) {
    const prev = sorted.filter((v) => v < current - 0.1);
    return prev.length ? prev[prev.length - 1] : null;
  } else {
    const next = sorted.filter((v) => v > current + 0.1);
    return next.length ? next[0] : null;
  }
}

function Card({
  h,
  checked,
  onToggle,
  onEdit,
  onNudge,
  onSetFit,
  onPreview,
}: {
  h: Highlight;
  checked: boolean;
  onToggle: () => void;
  onEdit: (id: string, f: "titleLine1" | "titleLine2", v: string) => void;
  onNudge: (id: string, edge: "start" | "end", dir: -1 | 1) => void;
  onSetFit: (id: string, fit: VideoFit) => void;
  onPreview: () => void;
}) {
  const fit = h.fit ?? "crop";
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        checked ? "border-accent bg-accent/5" : "border-line bg-panel"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded bg-panel2 px-2 py-0.5 font-mono">
              {mmss(h.startSec)} – {mmss(h.endSec)}
            </span>
            <span>{durLabel(h.endSec - h.startSec)}</span>
            <span className="rounded bg-accent/15 px-2 py-0.5 text-accent">{h.sectionTitle}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/80">{h.summary}</p>
          <button
            onClick={onPreview}
            className="mt-2 text-sm font-bold text-accent hover:underline"
          >
            ▶ 미리보기
          </button>
        </div>
        <button
          onClick={onToggle}
          className={`mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 ${
            checked ? "border-accent bg-accent text-black" : "border-line text-transparent"
          }`}
          aria-label="선택"
        >
          ✓
        </button>
      </div>

      {/* boundary nudge */}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted">
        <span>시작</span>
        <NudgeBtns onDown={() => onNudge(h.id, "start", -1)} onUp={() => onNudge(h.id, "start", 1)} />
        <span className="ml-2">끝</span>
        <NudgeBtns onDown={() => onNudge(h.id, "end", -1)} onUp={() => onNudge(h.id, "end", 1)} />
      </div>

      {/* framing */}
      <div className="mt-3">
        <div className="mb-1.5 text-xs text-muted">화면 맞춤</div>
        <div className="grid grid-cols-2 gap-1.5">
          <Chip active={fit === "crop"} onClick={() => onSetFit(h.id, "crop")}>
            인물 중심
          </Chip>
          <Chip active={fit === "contain"} onClick={() => onSetFit(h.id, "contain")}>
            전체 화면
          </Chip>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          {fit === "crop"
            ? "좌우를 잘라 꽉 채웁니다. 설교자만 나오는 구간에 좋아요."
            : "영상 전체가 들어갑니다. PPT·성경구절이 나오는 구간에 좋아요."}
        </p>
      </div>

      {/* editable title */}
      <div className="mt-3 space-y-2">
        <div className="text-xs text-muted">제목 (직접 수정 가능)</div>
        <input
          value={h.titleLine1}
          onChange={(e) => onEdit(h.id, "titleLine1", e.target.value)}
          className="input py-2 text-sm"
        />
        <input
          value={h.titleLine2}
          onChange={(e) => onEdit(h.id, "titleLine2", e.target.value)}
          className="input py-2 text-sm font-bold text-accent"
        />
      </div>
    </div>
  );
}

function NudgeBtns({ onDown, onUp }: { onDown: () => void; onUp: () => void }) {
  return (
    <span className="inline-flex overflow-hidden rounded-md border border-line">
      <button onClick={onDown} className="bg-panel2 px-2 py-1 hover:bg-line" title="앞 자막으로">
        ◄
      </button>
      <button onClick={onUp} className="border-l border-line bg-panel2 px-2 py-1 hover:bg-line" title="뒤 자막으로">
        ►
      </button>
    </span>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-2 py-2 text-sm transition ${
        active ? "border-accent bg-accent text-black font-bold" : "border-line bg-panel2 text-muted hover:border-accent/40"
      }`}
    >
      {children}
    </button>
  );
}
