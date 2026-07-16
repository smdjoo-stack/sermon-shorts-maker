// Layout constants — MEASURED pixel-for-pixel from the two sample videos
// (설교쇼츠 (1).mp4 dark, 설교쇼츠 (2).mp4 light). Do not eyeball; these are the spec.
//
// Canvas 1080x1920, split exactly 25% / 50% / 25%:
//   title band  y 0    - 479   (480px)
//   video       y 480  - 1439  (960px, 1080x960 = 9:8, center-cropped)
//   subtitle    y 1440 - 1919  (480px)

import type { SubtitlePosition, SubtitleSize, TemplateId } from "./types";

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

export const TITLE_BAND = { top: 0, height: 480 };
export const VIDEO_BAND = { top: 480, height: 960 };
export const SUB_BAND = { top: 1440, height: 480 };

// Title text (measured): line1 y≈197-287, line2 y≈313-402, glyph height ≈90, gap ≈26.
// We render title centered in the top band.
export const TITLE = {
  centerX: CANVAS_W / 2, // 540
  line1CenterY: 242, // (197+287)/2
  line2CenterY: 357, // (313+402)/2
  fontSize: 116, // tuned so glyph height ≈90 (measured render at 96 gave ~72)
  maxTextWidth: 900, // observed max 727; keep 90px side margins
  minFontSize: 56,
};

export interface Template {
  id: TemplateId;
  label: string;
  bg: string; // hex, used as ffmpeg pad color and ASS背景
  titleLine1: string; // hex
  titleLine2: string; // hex (accent)
  subtitle: string; // hex — subtitle text color
  subtitleOutline: string; // hex — subtitle outline
}

export const TEMPLATES: Record<TemplateId, Template> = {
  dark: {
    id: "dark",
    label: "기본 (다크)",
    bg: "#000000",
    titleLine1: "#FFFFFF",
    titleLine2: "#FFFF5A",
    subtitle: "#FFFFFF",
    subtitleOutline: "#000000",
  },
  light: {
    id: "light",
    label: "라이트",
    bg: "#F2EEE6",
    titleLine1: "#1B243D",
    titleLine2: "#C1392B",
    subtitle: "#1B243D",
    subtitleOutline: "#F2EEE6",
  },
};

// Subtitle font sizes per level (ASS Fontsize, canvas-relative).
export const SUB_FONT_SIZE: Record<SubtitleSize, number> = {
  small: 46,
  medium: 58,
  large: 70,
  xlarge: 84,
};

// Vertical placement per position preset.
// Returns ASS alignment (numpad) + marginV (px from the aligned edge).
export function subtitlePlacement(pos: SubtitlePosition): {
  alignment: number;
  marginV: number;
} {
  switch (pos) {
    case "band":
      // centered inside bottom band (1440-1919). Anchor bottom, lift up to band center-ish.
      return { alignment: 2, marginV: 190 };
    case "video-under":
      // just under the video (y ~1440), anchor bottom of screen but high margin
      return { alignment: 2, marginV: 430 };
    case "video-bottom":
      // inside the video area, near its bottom edge
      return { alignment: 2, marginV: 500 };
    case "screen-bottom":
      return { alignment: 2, marginV: 70 };
  }
}
