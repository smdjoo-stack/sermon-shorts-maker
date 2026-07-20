// Shared domain types.

export interface Cue {
  start: number; // seconds
  end: number; // seconds
  text: string;
}

export interface WordToken {
  t: number; // seconds
  w: string;
}

export type TemplateId = "dark" | "light";

// How the source frame fills the 1080x960 video band.
//   crop    — scale to height, center-crop width. Fills the band; sides are cut.
//             Good for a preacher centered on stage.
//   contain — fit the whole frame inside the band, letterboxed with the
//             template bg. Nothing is cut. Good when slides/PPT are on screen.
export type VideoFit = "crop" | "contain";

export type SubtitlePosition =
  | "band" // 하단 자막 띠 (기본) — y 1440~1919
  | "video-bottom" // 영상 영역 안쪽 아래
  | "screen-bottom" // 화면 맨 아래
  | "video-under"; // 영상 바로 아래

export type SubtitleSize = "small" | "medium" | "large" | "xlarge";

export interface SubtitleOptions {
  enabled: boolean;
  size: SubtitleSize;
  position: SubtitlePosition;
}

export type TitleSize = "small" | "medium" | "large" | "xlarge";

// Title look. Colors are hex; undefined means "use the template's color", so a
// highlight that was never customised still follows the template.
export interface TitleStyle {
  size: TitleSize;
  line1Color?: string;
  line2Color?: string;
}

export const DEFAULT_TITLE_STYLE: TitleStyle = { size: "medium" };

export interface Highlight {
  id: string;
  startSec: number;
  endSec: number;
  titleLine1: string;
  titleLine2: string;
  summary: string;
  sectionTitle: string;
  // per-segment framing choice (defaults to "crop")
  fit?: VideoFit;
  // Per-segment look. Baked in when rendering starts, then editable on the
  // result screen — you only know the subtitles are too big once you see them.
  subtitles?: SubtitleOptions;
  titleStyle?: TitleStyle;
  // caption cues that fall inside [startSec, endSec], relative timing kept absolute
  cues: Cue[];
}

export interface VideoMeta {
  videoId: string;
  title: string;
  durationSec: number;
}

export interface AnalyzeResult {
  meta: VideoMeta;
  highlights: Highlight[];
  hasCaptions: boolean;
}

export interface RenderRequest {
  videoUrl: string;
  videoId: string;
  highlight: Highlight;
  template: TemplateId;
  subtitles: SubtitleOptions;
  // church badge (optional)
  churchName?: string;
  churchLogo?: string; // data URL (image/png|jpeg|webp;base64,...)
}

// Job queue
export type JobKind = "analyze" | "render";
export type JobStatus = "queued" | "running" | "done" | "error";

export interface Job<T = unknown> {
  id: string;
  kind: JobKind;
  status: JobStatus;
  progress: number; // 0..1
  message: string;
  result?: T;
  error?: string;
  createdAt: number;
}
