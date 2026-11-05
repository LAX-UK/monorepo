import sharp from "sharp";
import type { StoredImageType } from "./validate-image.js";

/** Longest side kept when a picture is scaled down; the same limit Shop applies. */
export const NORMALIZED_MAX_EDGE_PX = 4000;
const MIN_EDGE_PX = 1200;
const SHRINK_FACTOR = 0.8;
const JPEG_QUALITY = 85;
const WEBP_QUALITY = 85;

/** The bytes are not a picture that can be decoded. */
export class ImageUndecodableError extends Error {
  constructor(cause?: unknown) {
    super("image_undecodable", { cause });
    this.name = "ImageUndecodableError";
  }
}

export type NormalizedImage = { bytes: Buffer; width: number; height: number };

/**
 * Makes a fetched picture safe to publish: applies its orientation, drops location and camera
 * data, and scales an oversized file down. Throws when the bytes cannot be decoded.
 */
export interface ImageNormalizer {
  normalize(bytes: Buffer, type: StoredImageType, maxBytes: number): Promise<NormalizedImage>;
}

function encode(pipeline: sharp.Sharp, type: StoredImageType): sharp.Sharp {
  switch (type) {
    case "image/jpeg":
      return pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    case "image/png":
      return pipeline.png({ compressionLevel: 9 });
    case "image/webp":
      return pipeline.webp({ quality: WEBP_QUALITY });
  }
}

async function render(bytes: Buffer, type: StoredImageType, maxEdge: number) {
  const { data, info } = await encode(
    sharp(bytes)
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .keepIccProfile(),
    type,
  ).toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height };
}

export function createSharpImageNormalizer(): ImageNormalizer {
  return {
    async normalize(bytes, type, maxBytes) {
      try {
        return await normalizeDecoded(bytes, type, maxBytes);
      } catch (error) {
        throw new ImageUndecodableError(error);
      }
    },
  };
}

async function normalizeDecoded(
  bytes: Buffer,
  type: StoredImageType,
  maxBytes: number,
): Promise<NormalizedImage> {
  const meta = await sharp(bytes).metadata();
  if (!meta.width || !meta.height) throw new Error("image_missing_dimensions");
  const swapped = (meta.orientation ?? 1) >= 5;
  const viewed = swapped
    ? { width: meta.height, height: meta.width }
    : { width: meta.width, height: meta.height };
  const longEdge = Math.max(viewed.width, viewed.height);

  // Untouched when already within limits and carrying no EXIF block to apply or strip.
  if (!meta.exif && longEdge <= NORMALIZED_MAX_EDGE_PX && bytes.byteLength <= maxBytes) {
    return { bytes, ...viewed };
  }
  let maxEdge = Math.min(longEdge, NORMALIZED_MAX_EDGE_PX);
  let out = await render(bytes, type, maxEdge);
  while (out.bytes.byteLength > maxBytes && maxEdge > MIN_EDGE_PX) {
    maxEdge = Math.max(MIN_EDGE_PX, Math.floor(maxEdge * SHRINK_FACTOR));
    out = await render(bytes, type, maxEdge);
  }
  return out;
}
