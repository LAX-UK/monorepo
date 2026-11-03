import sharp from "sharp";
import type {
  ImageFormat,
  ImageNormalizerPort,
  NormalizedImage,
} from "../application/ports/image-normalizer.port.js";

/** Longest side kept when an image is scaled down. */
export const NORMALIZED_MAX_EDGE_PX = 4000;
/** Stored files stay at or under this size. */
export const NORMALIZED_MAX_BYTES = 10 * 1024 * 1024;
const MIN_EDGE_PX = 1200;
const SHRINK_FACTOR = 0.8;
const JPEG_QUALITY = 85;
const WEBP_QUALITY = 85;

function encode(pipeline: sharp.Sharp, contentType: ImageFormat): sharp.Sharp {
  switch (contentType) {
    case "image/jpeg":
      return pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    case "image/png":
      return pipeline.png({ compressionLevel: 9 });
    case "image/webp":
      return pipeline.webp({ quality: WEBP_QUALITY });
  }
}

/** Orientation is applied first, so edge limits and dimensions describe the image as viewed. */
async function render(bytes: Buffer, contentType: ImageFormat, maxEdge: number) {
  const { data, info } = await encode(
    sharp(bytes)
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .keepIccProfile(),
    contentType,
  ).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export function createSharpImageNormalizer(): ImageNormalizerPort {
  return {
    async normalize(bytes, contentType): Promise<NormalizedImage> {
      const meta = await sharp(bytes).metadata();
      if (!meta.width || !meta.height) throw new Error("image_missing_dimensions");
      const original = { width: meta.width, height: meta.height, bytes: bytes.byteLength };
      const swapped = (meta.orientation ?? 1) >= 5;
      const viewed = swapped
        ? { width: meta.height, height: meta.width }
        : { width: meta.width, height: meta.height };
      const longEdge = Math.max(viewed.width, viewed.height);

      // Untouched when already within limits and carrying no EXIF block to apply or strip.
      if (
        !meta.exif &&
        longEdge <= NORMALIZED_MAX_EDGE_PX &&
        bytes.byteLength <= NORMALIZED_MAX_BYTES
      ) {
        return {
          bytes,
          contentType,
          original,
          stored: { ...viewed, bytes: bytes.byteLength },
        };
      }

      let maxEdge = Math.min(longEdge, NORMALIZED_MAX_EDGE_PX);
      let out = await render(bytes, contentType, maxEdge);
      while (out.data.byteLength > NORMALIZED_MAX_BYTES && maxEdge > MIN_EDGE_PX) {
        maxEdge = Math.max(MIN_EDGE_PX, Math.floor(maxEdge * SHRINK_FACTOR));
        out = await render(bytes, contentType, maxEdge);
      }
      return {
        bytes: out.data,
        contentType,
        original,
        stored: { width: out.width, height: out.height, bytes: out.data.byteLength },
      };
    },
  };
}
