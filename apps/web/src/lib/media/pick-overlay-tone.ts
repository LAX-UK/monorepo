import type { OverlayToneResult, RegionPixels, SlotType } from "./overlay-tone-types";

export const SAMPLE_SIZE = 32;

/** WCAG relative luminance for sRGB channel (0–255). */
export function relativeLuminance(r: number, g: number, b: number): number {
  const linearize = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two relative luminances. */
export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function percentile(sorted: Float32Array, p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return sorted[index] ?? 0;
}

/** Build luminance array from raw RGBA ImageData. */
export function luminancesFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const count = width * height;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    out[i] = relativeLuminance(data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0);
  }
  return out;
}

/** Percentile luminance from region pixels (sorted copy). */
export function percentileLuminance(pixels: RegionPixels, percentileValue: number): number {
  const sorted = Float32Array.from(pixels.luminances).sort();
  return percentile(sorted, percentileValue);
}

function frostedContrast(
  tone: "light" | "dark",
  backdropHigh: number,
  backdropLow: number,
): number {
  const bgAlpha = tone === "light" ? 0.45 : 0.78;
  const fgLum = tone === "light" ? relativeLuminance(255, 255, 255) : relativeLuminance(5, 5, 5);
  const chipBgLum =
    tone === "light" ? relativeLuminance(0, 0, 0) : relativeLuminance(255, 255, 255);

  const highEffectiveBg = chipBgLum * bgAlpha + backdropHigh * (1 - bgAlpha);
  const lowEffectiveBg = chipBgLum * bgAlpha + backdropLow * (1 - bgAlpha);

  return Math.min(contrastRatio(fgLum, highEffectiveBg), contrastRatio(fgLum, lowEffectiveBg));
}

function solidContrast(tone: "light" | "dark", backdropHigh: number, backdropLow: number): number {
  const fgLum = tone === "light" ? relativeLuminance(255, 255, 255) : relativeLuminance(5, 5, 5);
  return Math.min(contrastRatio(fgLum, backdropHigh), contrastRatio(fgLum, backdropLow));
}

const THRESHOLDS: Record<SlotType, number> = {
  pill: 3.0,
  heroBody: 4.5,
  heroDisplay: 3.0,
};

/** Pick overlay tone from pre-extracted region pixels. */
export function pickOverlayToneFromRegion(
  pixels: RegionPixels,
  slotType: SlotType,
): OverlayToneResult {
  const threshold = THRESHOLDS[slotType];
  const high = percentileLuminance(pixels, 0.95);
  const low = percentileLuminance(pixels, 0.05);

  const lightFrosted = frostedContrast("light", high, low);
  const darkFrosted = frostedContrast("dark", high, low);

  if (lightFrosted >= threshold && lightFrosted >= darkFrosted) {
    return { kind: "frosted", tone: "light", contrast: lightFrosted };
  }
  if (darkFrosted >= threshold) {
    return { kind: "frosted", tone: "dark", contrast: darkFrosted };
  }

  const solidLight = solidContrast("light", high, low);
  const solidDark = solidContrast("dark", high, low);
  const tone = solidLight >= solidDark ? "light" : "dark";
  const contrast = Math.max(solidLight, solidDark);

  return { kind: "opaque", tone, contrast };
}

/** Default when canvas is tainted — safe light opaque. */
export function defaultTaintedResult(): OverlayToneResult {
  return { kind: "opaque", tone: "light", contrast: 21 };
}
