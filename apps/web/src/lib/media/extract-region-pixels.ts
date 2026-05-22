import type { NormalizedRect, RegionPixels } from "./overlay-tone-types";
import { SAMPLE_SIZE, luminancesFromImageData } from "./pick-overlay-tone";

export type ExtractResult = RegionPixels | { error: "tainted" | "failed" };

/** Extract downsampled luminance samples from an image region (hand-rolled canvas). */
export function extractRegionPixels(
  img: HTMLImageElement,
  imageSpaceRect: NormalizedRect,
): ExtractResult {
  const { naturalWidth: iw, naturalHeight: ih } = img;
  if (iw <= 0 || ih <= 0) return { error: "failed" };

  const sx = Math.round(imageSpaceRect.x * iw);
  const sy = Math.round(imageSpaceRect.y * ih);
  const sw = Math.max(1, Math.round(imageSpaceRect.w * iw));
  const sh = Math.max(1, Math.round(imageSpaceRect.h * ih));

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { error: "failed" };

  try {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const luminances = luminancesFromImageData(imageData.data, SAMPLE_SIZE, SAMPLE_SIZE);
    return { luminances, width: SAMPLE_SIZE, height: SAMPLE_SIZE };
  } catch {
    return { error: "tainted" };
  }
}

/** Build RegionPixels from synthetic RGBA for tests. */
export function regionPixelsFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): RegionPixels {
  return {
    luminances: luminancesFromImageData(data, width, height),
    width,
    height,
  };
}
