"use client";

import { useState } from "react";
import type { Cue, Highlight } from "@/lib/types";
import { mmss } from "@/lib/format";

export interface RenderedItem {
  highlight: Highlight;
  status: "pending" | "rendering" | "done" | "error";
  progress: number;
  message: string;
  url?: string;
  name?: string;
  error?: string;
}

export default function ResultList({
  items,
  onEditSubtitles,
  onBack,
}: {
  items: RenderedItem[];
  onEditSubtitles: (highlightId: string, cues: Cue[]) => void;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState<RenderedItem | null>(null);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-extrabold">쇼츠가 완성됐어요 🎉</h2>
        <button onClick={onBack} className="text-sm text-muted hover:text-white">
          ← 구간 다시 고르기
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.highlight.id} className="rounded-2xl border border-line bg-panel p-4">
            <div className="mb-3 text-sm text-muted">
              {mmss(it.highlight.startSec)} – {mmss(it.highlight.endSec)} · {it.highlight.titleLine1}{" "}
              {it.highlight.titleLine2}
            </div>

            {it.status === "done" && it.url ? (
              <>
                <video
                  src={it.url}
                  controls
                  playsInline
                  className="mx-auto aspect-[9/16] w-full max-w-[280px] rounded-xl bg-black"
                />
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setEditing(it)}
                    className="flex-1 rounded-xl border border-line bg-panel2 py-2.5 text-sm font-bold hover:border-accent"
                  >
                    ✎ 자막 수정
                  </button>
                  <a
                    href={`${it.url}&download=1`}
                    className="flex-1 rounded-xl bg-accent py-2.5 text-center text-sm font-extrabold text-black hover:bg-accent2"
                  >
                    ⬇ 다운로드
                  </a>
                </div>
              </>
            ) : it.status === "error" ? (
              <div className="flex aspect-[9/16] max-w-[280px] mx-auto items-center justify-center rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center text-sm text-red-400">
                {it.error || "렌더링 실패"}
              </div>
            ) : (
              <div className="mx-auto flex aspect-[9/16] max-w-[280px] flex-col items-center justify-center rounded-xl bg-panel2">
                <Spinner />
                <div className="mt-3 text-sm text-muted">{it.message}</div>
                <div className="mt-3 h-1.5 w-32 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${Math.round(it.progress * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <SubtitleEditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(cues) => {
            onEditSubtitles(editing.highlight.id, cues);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SubtitleEditModal({
  item,
  onClose,
  onSave,
}: {
  item: RenderedItem;
  onClose: () => void;
  onSave: (cues: Cue[]) => void;
}) {
  const [cues, setCues] = useState<Cue[]>(item.highlight.cues.map((c) => ({ ...c })));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-line bg-panel">
        <div className="border-b border-line p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">자막 수정</h3>
            <button onClick={onClose} className="text-muted hover:text-white">
              ✕
            </button>
          </div>
          <p className="mt-1 text-sm text-muted">
            잘못 인식된 글자를 고쳐 보세요. 저장하면 다시 렌더링됩니다.
          </p>
        </div>

        <div className="scroll-thin flex-1 space-y-2 overflow-y-auto p-5">
          {cues.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 w-12 flex-shrink-0 font-mono text-xs text-muted">
                {mmss(c.start)}
              </span>
              <textarea
                value={c.text}
                onChange={(e) => {
                  const n = [...cues];
                  n[i] = { ...n[i], text: e.target.value };
                  setCues(n);
                }}
                rows={1}
                className="input min-h-[42px] resize-y py-2 text-sm"
              />
            </div>
          ))}
          {cues.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">이 구간에는 자막이 없습니다.</p>
          )}
        </div>

        <div className="flex gap-3 border-t border-line p-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-line py-3 font-bold text-muted hover:text-white"
          >
            취소
          </button>
          <button
            onClick={() => onSave(cues)}
            className="flex-1 rounded-xl bg-accent py-3 font-extrabold text-black hover:bg-accent2"
          >
            수정 반영
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
  );
}
