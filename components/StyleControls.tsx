"use client";

// Shared look controls. Used before rendering (as the defaults for every clip)
// and again on the result screen, where they edit one finished clip — you only
// find out the subtitles are too big once you've watched it.

import { TITLE_COLOR_PRESETS } from "@/lib/layout";
import type {
  SubtitleOptions,
  SubtitlePosition,
  SubtitleSize,
  TitleSize,
  TitleStyle,
} from "@/lib/types";

const SUB_SIZES: { v: SubtitleSize; label: string }[] = [
  { v: "small", label: "작게" },
  { v: "medium", label: "보통" },
  { v: "large", label: "크게" },
  { v: "xlarge", label: "아주 크게" },
];

const SUB_POSITIONS: { v: SubtitlePosition; label: string }[] = [
  { v: "band", label: "하단 자막칸" },
  { v: "video-under", label: "영상 바로 아래" },
  { v: "video-bottom", label: "영상 안 하단" },
  { v: "screen-bottom", label: "화면 맨 아래" },
];

const TITLE_SIZES: { v: TitleSize; label: string }[] = [
  { v: "small", label: "작게" },
  { v: "medium", label: "보통" },
  { v: "large", label: "크게" },
  { v: "xlarge", label: "아주 크게" },
];

export function Chip({
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
      className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
        active
          ? "border-accent bg-accent text-black"
          : "border-line bg-panel2 text-muted hover:border-accent/50 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Swatch({
  hex,
  label,
  active,
  onClick,
}: {
  hex: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`h-8 w-8 rounded-full border-2 transition ${
        active ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-white/40"
      }`}
      style={{ backgroundColor: hex }}
    />
  );
}

export function SubtitleControls({
  value,
  onChange,
}: {
  value: SubtitleOptions;
  onChange: (v: SubtitleOptions) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-bold">자막</h4>
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
          <span className={value.enabled ? "text-white" : "text-muted"}>자막 넣기</span>
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
            className="h-4 w-4 accent-[#F5C518]"
          />
        </label>
      </div>

      {value.enabled && (
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-xs text-muted">크기</div>
            <div className="grid grid-cols-4 gap-1.5">
              {SUB_SIZES.map((s) => (
                <Chip key={s.v} active={value.size === s.v} onClick={() => onChange({ ...value, size: s.v })}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs text-muted">위치</div>
            <div className="grid grid-cols-2 gap-1.5">
              {SUB_POSITIONS.map((p) => (
                <Chip
                  key={p.v}
                  active={value.position === p.v}
                  onClick={() => onChange({ ...value, position: p.v })}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TitleControls({
  value,
  onChange,
  line1,
  line2,
  onLine1,
  onLine2,
}: {
  value: TitleStyle;
  onChange: (v: TitleStyle) => void;
  // Text is optional: the result screen edits it here, the select screen
  // already has its own inputs on each card.
  line1?: string;
  line2?: string;
  onLine1?: (v: string) => void;
  onLine2?: (v: string) => void;
}) {
  const showText = onLine1 && onLine2;
  return (
    <div>
      <h4 className="mb-3 font-bold">제목</h4>

      {showText && (
        <div className="mb-3 space-y-2">
          <input
            value={line1 ?? ""}
            onChange={(e) => onLine1!(e.target.value)}
            placeholder="1줄"
            className="input py-2 text-sm"
          />
          <input
            value={line2 ?? ""}
            onChange={(e) => onLine2!(e.target.value)}
            placeholder="2줄 (강조)"
            className="input py-2 text-sm"
          />
        </div>
      )}

      <div className="space-y-3">
        <div>
          <div className="mb-1.5 text-xs text-muted">크기</div>
          <div className="grid grid-cols-4 gap-1.5">
            {TITLE_SIZES.map((s) => (
              <Chip key={s.v} active={value.size === s.v} onClick={() => onChange({ ...value, size: s.v })}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs text-muted">1줄 색상</div>
          <div className="flex flex-wrap gap-2">
            {TITLE_COLOR_PRESETS.map((c) => (
              <Swatch
                key={c.hex}
                hex={c.hex}
                label={c.label}
                active={value.line1Color === c.hex}
                onClick={() => onChange({ ...value, line1Color: c.hex })}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs text-muted">2줄 색상 (강조)</div>
          <div className="flex flex-wrap gap-2">
            {TITLE_COLOR_PRESETS.map((c) => (
              <Swatch
                key={c.hex}
                hex={c.hex}
                label={c.label}
                active={value.line2Color === c.hex}
                onClick={() => onChange({ ...value, line2Color: c.hex })}
              />
            ))}
          </div>
        </div>

        {(value.line1Color || value.line2Color) && (
          <button
            onClick={() => onChange({ size: value.size })}
            className="text-xs text-muted underline hover:text-white"
          >
            색상을 템플릿 기본값으로 되돌리기
          </button>
        )}
      </div>
    </div>
  );
}
