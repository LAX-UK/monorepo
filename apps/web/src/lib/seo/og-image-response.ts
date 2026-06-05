import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import sharp from "sharp";

/** Standard Open Graph card dimensions (1.91:1) shared by all generated cards. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * JPEG so photographic cards stay small. `next/og` only emits lossless PNG,
 * which pushes 1200x630 photo composites well past WhatsApp's ~600KB cap and
 * causes the preview image to be silently dropped. JPEG q82 keeps these ~85KB.
 */
export const OG_IMAGE_CONTENT_TYPE = "image/jpeg";

const OG_CACHE_CONTROL = "public, immutable, no-transform, max-age=31536000";
const DEFAULT_JPEG_QUALITY = 82;

/**
 * Render an OG card to a compressed JPEG `Response`.
 *
 * Requires the Node.js runtime (sharp is a native module); the route that uses
 * this must declare `export const runtime = "nodejs"`.
 */
export async function renderOgJpeg(
  element: ReactElement,
  { quality = DEFAULT_JPEG_QUALITY }: { quality?: number } = {},
): Promise<Response> {
  const png = await new ImageResponse(element, { ...OG_IMAGE_SIZE }).arrayBuffer();
  const jpeg = await sharp(Buffer.from(png)).jpeg({ quality, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": OG_IMAGE_CONTENT_TYPE,
      "Cache-Control": OG_CACHE_CONTROL,
    },
  });
}
