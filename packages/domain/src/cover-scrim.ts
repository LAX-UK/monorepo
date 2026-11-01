import {
  COVER_TEXT_LINES,
  type CoverBreakpointAnalysis,
  type CoverBreakpointName,
  type CoverScrimSetting,
  type CoverTextLine,
  type CoverTextSide,
  type CoverTextTone,
  type CoverToneSolution,
  type CoverZoneSample,
} from "@auction/types";
import { type Rgb, blend, contrastRatio, parseHex } from "./cover-colour.js";
import { COVER_BOXES } from "./cover-crop.js";

/**
 * The measured scrim. A scrim is a radial gradient from the corner under the text plus a band
 * along the bottom for the credit line. This solver finds the weakest scrim at which every line
 * of text reaches its WCAG AA contrast on the brightest (or, for dark type, darkest) part of the
 * picture behind it. It is pure: the pictures are measured elsewhere and arrive as zone samples.
 *
 * Text tone is the colour of the type: "light" is white type on a dark scrim, "dark" is ink type
 * on a paper scrim.
 */

export const SCRIM_STRENGTH_FLOOR = 0.45;
export const SCRIM_STRENGTH_CAP = 0.85;
export const CREDIT_BAND_CAP = 0.9;
/** Dark type must need a scrim at least this much weaker than light type to be chosen. */
export const DARK_TONE_MARGIN = 0.12;
const SEARCH_STEP = 0.01;

export const SCRIM_COLOUR: Record<CoverTextTone, Rgb> = {
  light: [10, 11, 11],
  dark: [246, 244, 238],
};

export type TextStyle = { colour: Rgb; alpha: number };

export const TEXT_STYLE: Record<CoverTextTone, Record<CoverTextLine, TextStyle>> = {
  light: {
    eyebrow: { colour: [255, 255, 255], alpha: 0.88 },
    title: { colour: [255, 255, 255], alpha: 1 },
    sub: { colour: [255, 255, 255], alpha: 0.88 },
    link: { colour: [255, 255, 255], alpha: 1 },
    credit: { colour: [255, 255, 255], alpha: 0.82 },
  },
  dark: {
    eyebrow: { colour: [57, 60, 60], alpha: 1 },
    title: { colour: [24, 26, 26], alpha: 1 },
    sub: { colour: [47, 50, 50], alpha: 1 },
    link: { colour: [24, 26, 26], alpha: 1 },
    credit: { colour: [57, 60, 60], alpha: 1 },
  },
};

/** WCAG AA: 3:1 for the 56px title (large text), 4.5:1 for everything else. */
export const LINE_MIN_CONTRAST: Record<CoverTextLine, number> = {
  eyebrow: 4.5,
  title: 3,
  sub: 4.5,
  link: 4.5,
  credit: 4.5,
};

// ─── Where each line sits ─────────────────────────────────────────────────────

type ZoneBox = { left: number; bottom: number; width: number; height: number };

/** Text zones for text on the left, measured from the left and bottom edges of the hero. */
const TEXT_ZONES: Record<CoverTextLine, ZoneBox> = {
  eyebrow: { left: 40, bottom: 290, width: 520, height: 20 },
  title: { left: 40, bottom: 154, width: 640, height: 120 },
  sub: { left: 40, bottom: 116, width: 560, height: 26 },
  link: { left: 40, bottom: 56, width: 480, height: 36 },
  credit: { left: 40, bottom: 24, width: 520, height: 16 },
};

export type ZoneRect = { x: number; y: number; width: number; height: number };

/** The rectangle of one line in hero pixels. The credit line sits opposite the text. */
export function coverZoneRect(
  breakpoint: CoverBreakpointName,
  line: CoverTextLine,
  side: CoverTextSide,
): ZoneRect {
  const { width: heroWidth, height: heroHeight } = COVER_BOXES[breakpoint];
  const zone = TEXT_ZONES[line];
  const onTextSide = line !== "credit";
  const fromLeft = onTextSide === (side === "left");
  return {
    x: fromLeft ? zone.left : heroWidth - zone.left - zone.width,
    y: heroHeight - zone.bottom - zone.height,
    width: zone.width,
    height: zone.height,
  };
}

// ─── The scrim shape, as the page paints it ───────────────────────────────────

/** Eased stops of the radial gradient: [percent of the radius, share of the strength]. */
export const RADIAL_STOPS: readonly (readonly [number, number])[] = [
  [0, 1],
  [30, 0.97],
  [50, 0.86],
  [64, 0.68],
  [78, 0.42],
  [90, 0.16],
  [100, 0],
];

/** Stops of the credit band: [pixels up from the bottom edge, share of the band strength]. */
export const BAND_STOPS: readonly (readonly [number, number])[] = [
  [0, 1],
  [28, 0.63],
  [56, 0.33],
  [84, 0.11],
  [112, 0],
];

/** The radial gradient's radii as a share of the hero. */
export const RADIAL_RADIUS = { x: 0.95, y: 1.25 } as const;

function interpolate(stops: readonly (readonly [number, number])[], at: number): number {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return 0;
  if (at <= first[0]) return first[1];
  if (at >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i++) {
    const to = stops[i];
    const from = stops[i - 1];
    if (to && from && at <= to[0]) {
      const t = (at - from[0]) / (to[0] - from[0]);
      return from[1] + (to[1] - from[1]) * t;
    }
  }
  return 0;
}

/** The weakest share of the strength any part of the zone receives. */
function radialShare(breakpoint: CoverBreakpointName, rect: ZoneRect, side: CoverTextSide): number {
  const { width, height } = COVER_BOXES[breakpoint];
  const originX = side === "left" ? 0 : width;
  const farthestX = Math.max(Math.abs(rect.x - originX), Math.abs(rect.x + rect.width - originX));
  const farthestY = Math.max(Math.abs(rect.y - height), Math.abs(rect.y + rect.height - height));
  const distance = Math.hypot(
    farthestX / (RADIAL_RADIUS.x * width),
    farthestY / (RADIAL_RADIUS.y * height),
  );
  return interpolate(RADIAL_STOPS, distance * 100);
}

function bandShare(breakpoint: CoverBreakpointName, rect: ZoneRect): number {
  const farthestFromBottom = COVER_BOXES[breakpoint].height - rect.y;
  return interpolate(BAND_STOPS, farthestFromBottom);
}

/** Opacity of the scrim over the weakest point of a line, from the radial and the credit band. */
export function lineScrimAlpha(
  breakpoint: CoverBreakpointName,
  line: CoverTextLine,
  side: CoverTextSide,
  strength: number,
  creditBand: number,
): number {
  const rect = coverZoneRect(breakpoint, line, side);
  const radial = strength * radialShare(breakpoint, rect, side);
  if (line !== "credit") return radial;
  const band = creditBand * bandShare(breakpoint, rect);
  return 1 - (1 - radial) * (1 - band);
}

// ─── Contrast ─────────────────────────────────────────────────────────────────

/** The part of the picture that is hardest for this type: the brightest for light, darkest for dark. */
function worstPixel(sample: CoverZoneSample, tone: CoverTextTone): Rgb {
  return parseHex(tone === "light" ? sample.brightest : sample.darkest);
}

function lineContrast(
  tone: CoverTextTone,
  line: CoverTextLine,
  sample: CoverZoneSample,
  scrimAlpha: number,
): number {
  const background = blend(worstPixel(sample, tone), SCRIM_COLOUR[tone], scrimAlpha);
  const style = TEXT_STYLE[tone][line];
  const text = blend(background, style.colour, style.alpha);
  return contrastRatio(text, background);
}

type Zones = Record<CoverTextLine, CoverZoneSample>;

function passes(
  tone: CoverTextTone,
  line: CoverTextLine,
  sample: CoverZoneSample,
  alpha: number,
): boolean {
  return lineContrast(tone, line, sample, alpha) >= LINE_MIN_CONTRAST[line];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function solveTone(
  tone: CoverTextTone,
  breakpoint: CoverBreakpointName,
  side: CoverTextSide,
  zones: Zones,
): CoverToneSolution | null {
  const bodyLines = COVER_TEXT_LINES.filter((line) => line !== "credit");

  let rawStrength: number | null = null;
  for (let step = 0; step <= 1 / SEARCH_STEP; step++) {
    const strength = round2(step * SEARCH_STEP);
    const ok = bodyLines.every((line) =>
      passes(tone, line, zones[line], lineScrimAlpha(breakpoint, line, side, strength, 0)),
    );
    if (ok) {
      rawStrength = strength;
      break;
    }
  }
  if (rawStrength === null || rawStrength > SCRIM_STRENGTH_CAP) return null;
  const strength = Math.max(SCRIM_STRENGTH_FLOOR, rawStrength);

  let creditBand: number | null = null;
  for (let step = 0; step <= CREDIT_BAND_CAP / SEARCH_STEP; step++) {
    const band = round2(step * SEARCH_STEP);
    if (
      passes(
        tone,
        "credit",
        zones.credit,
        lineScrimAlpha(breakpoint, "credit", side, strength, band),
      )
    ) {
      creditBand = band;
      break;
    }
  }
  if (creditBand === null) return null;

  const contrast = Object.fromEntries(
    COVER_TEXT_LINES.map((line) => [
      line,
      round2(
        lineContrast(
          tone,
          line,
          zones[line],
          lineScrimAlpha(breakpoint, line, side, strength, creditBand),
        ),
      ),
    ]),
  ) as Record<CoverTextLine, number>;

  return { strength, creditBand, rawStrength, contrast };
}

/** Light type unless dark type needs a clearly weaker scrim; null when neither tone passes. */
export function chooseTone(
  light: CoverToneSolution | null,
  dark: CoverToneSolution | null,
): CoverTextTone | null {
  if (light && dark) {
    return dark.rawStrength <= light.rawStrength - DARK_TONE_MARGIN ? "dark" : "light";
  }
  if (light) return "light";
  if (dark) return "dark";
  return null;
}

/** Solves both tones for one hero size from what was measured in each text zone. */
export function solveCoverScrim(
  breakpoint: CoverBreakpointName,
  side: CoverTextSide,
  zones: Zones,
): CoverBreakpointAnalysis {
  const light = solveTone("light", breakpoint, side, zones);
  const dark = solveTone("dark", breakpoint, side, zones);
  return { zones, light, dark, recommended: chooseTone(light, dark) };
}

/**
 * The scrim a page paints for one hero size: the staff override if there is one, otherwise the
 * recommended tone. Null when that tone cannot reach contrast, and the cover uses the plate.
 */
export function scrimSettingFor(
  analysis: CoverBreakpointAnalysis | undefined,
  toneOverride: CoverTextTone | undefined,
): CoverScrimSetting | null {
  if (!analysis) return null;
  const tone = toneOverride ?? analysis.recommended;
  if (!tone) return null;
  const solution = analysis[tone];
  if (!solution) return null;
  return { tone, strength: solution.strength, creditBand: solution.creditBand };
}
