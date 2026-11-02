import "server-only";

import { plateFieldColour, toHex } from "@auction/domain";

/** Used when a lot photograph has no preview to read: a deep neutral that white passes 13:1 on. */
export const DEFAULT_PLATE_FIELD = toHex(plateFieldColour([38, 42, 48]));

/** The share of the darkest pixels averaged into the plate's "deepest colour". */
const DEEPEST_SHARE = 0.15;

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The mean colour of the darkest pixels, from raw RGB. */
export function deepestOfRgb(data: Uint8Array | Buffer): [number, number, number] | null {
  const pixels: [number, number, number][] = [];
  for (let i = 0; i + 2 < data.length; i += 3) {
    pixels.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]);
  }
  if (pixels.length === 0) return null;
  pixels.sort((a, b) => luminance(...a) - luminance(...b));
  const darkest = pixels.slice(0, Math.max(1, Math.round(pixels.length * DEEPEST_SHARE)));
  const sum = darkest.reduce(
    (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b] as [number, number, number],
    [0, 0, 0] as [number, number, number],
  );
  return [sum[0] / darkest.length, sum[1] / darkest.length, sum[2] / darkest.length];
}

const cache = new Map<string, string>();

/**
 * The plate colour for a lot photograph, read from its small blur preview so no large image is
 * downloaded: the photograph's deepest colour, darkened until white type reaches 13:1 on it.
 */
export async function plateFieldFromPreview(blurDataURL: string | undefined): Promise<string> {
  if (!blurDataURL) return DEFAULT_PLATE_FIELD;
  const cached = cache.get(blurDataURL);
  if (cached) return cached;
  try {
    const base64 = blurDataURL.slice(blurDataURL.indexOf(",") + 1);
    const { default: sharp } = await import("sharp");
    const { data } = await sharp(Buffer.from(base64, "base64"))
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true });
    const deepest = deepestOfRgb(data);
    const field = deepest ? toHex(plateFieldColour(deepest)) : DEFAULT_PLATE_FIELD;
    cache.set(blurDataURL, field);
    return field;
  } catch {
    return DEFAULT_PLATE_FIELD;
  }
}
