import { type Rgb, relativeLuminance, toHex } from "@auction/domain";
import type { CoverZoneSample } from "@auction/types";

/** Raw pixels, three bytes (red, green, blue) per pixel, row by row. */
export type RgbPixels = { data: Uint8Array; width: number; height: number };

export type PixelRect = { x: number; y: number; width: number; height: number };

const BRIGHTEST_PERCENTILE = 0.98;
const DARKEST_PERCENTILE = 0.02;

function pixelAt(pixels: RgbPixels, index: number): Rgb {
  const offset = index * 3;
  return [pixels.data[offset] ?? 0, pixels.data[offset + 1] ?? 0, pixels.data[offset + 2] ?? 0];
}

/**
 * The colour at the 98th percentile of lightness in a zone, and at the 2nd. Light type is limited
 * by the lightest part of the picture behind it and dark type by the darkest, and a percentile
 * ignores a stray highlight (a glint, a speck) that nobody reads against.
 */
export function sampleZone(pixels: RgbPixels, rect: PixelRect): CoverZoneSample {
  const left = Math.max(0, Math.floor(rect.x));
  const top = Math.max(0, Math.floor(rect.y));
  const right = Math.min(pixels.width, Math.ceil(rect.x + rect.width));
  const bottom = Math.min(pixels.height, Math.ceil(rect.y + rect.height));

  const indexes: number[] = [];
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) indexes.push(y * pixels.width + x);
  }
  if (indexes.length === 0) throw new Error("cover_zone_outside_picture");

  const ranked = indexes
    .map((index) => ({ index, lightness: relativeLuminance(pixelAt(pixels, index)) }))
    .sort((a, b) => a.lightness - b.lightness);
  const pick = (percentile: number) =>
    ranked[Math.min(ranked.length - 1, Math.floor(ranked.length * percentile))];
  const brightest = pick(BRIGHTEST_PERCENTILE);
  const darkest = pick(DARKEST_PERCENTILE);
  if (!brightest || !darkest) throw new Error("cover_zone_outside_picture");

  return {
    brightest: toHex(pixelAt(pixels, brightest.index)),
    darkest: toHex(pixelAt(pixels, darkest.index)),
  };
}

/** A bucket needs this share of the picture to count as one of its colours. */
const SIGNIFICANT_SHARE = 0.02;
const BUCKET_BITS = 4;

type Bucket = { count: number; red: number; green: number; blue: number };

/**
 * The colour most of the picture is made of, and its deepest significant colour. Pixels fall
 * into coarse colour buckets; the dominant colour is the fullest bucket, the deepest is the
 * darkest bucket that holds at least a fiftieth of the picture, so a few black pixels in a frame
 * do not make a plate field.
 */
export function extractPalette(pixels: RgbPixels): { dominant: Rgb; deepest: Rgb } {
  const buckets = new Map<number, Bucket>();
  const total = pixels.width * pixels.height;
  const shift = 8 - BUCKET_BITS;
  for (let index = 0; index < total; index++) {
    const [red, green, blue] = pixelAt(pixels, index);
    const key =
      ((red >> shift) << (BUCKET_BITS * 2)) | ((green >> shift) << BUCKET_BITS) | (blue >> shift);
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  }
  if (buckets.size === 0) throw new Error("cover_picture_empty");

  const mean = (bucket: Bucket): Rgb => [
    bucket.red / bucket.count,
    bucket.green / bucket.count,
    bucket.blue / bucket.count,
  ];
  const all = [...buckets.values()];
  const fullest = all.reduce((best, bucket) => (bucket.count > best.count ? bucket : best));
  const significant = all.filter((bucket) => bucket.count / total >= SIGNIFICANT_SHARE);
  const darkest = (significant.length > 0 ? significant : [fullest]).reduce((best, bucket) =>
    relativeLuminance(mean(bucket)) < relativeLuminance(mean(best)) ? bucket : best,
  );
  return { dominant: mean(fullest), deepest: mean(darkest) };
}
