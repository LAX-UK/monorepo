import { ImageResponse } from "next/og";
import type { ReactElement } from "react";

/** Standard Open Graph card dimensions (1.91:1) shared by all generated cards. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * JPEG so photographic cards stay small. `next/og` only emits lossless PNG,
 * which pushes 1200x630 photo composites well past WhatsApp's ~600KB cap and
 * causes the preview image to be silently dropped. JPEG q82 keeps these ~85KB.
 */
export const OG_IMAGE_CONTENT_TYPE = "image/jpeg";

const OG_CACHE_CONTROL = "public, immutable, no-transform, max-age=31536000";
/** A PNG served because JPEG compression was unavailable is not cached for long. */
const OG_FALLBACK_CACHE_CONTROL = "public, no-transform, max-age=300";
const DEFAULT_JPEG_QUALITY = 82;

type Sharp = typeof import("sharp")["default"];

let sharpLoad: Promise<Sharp | null> | null = null;

/**
 * Loads sharp when a card is first drawn, never when a page module loads. Sale, lot and artist
 * pages import their `opengraph-image` module to build their metadata; a top-level sharp import
 * there meant a missing native binary (as in the web image, where sharp's libvips is not traced
 * into the standalone output) failed the whole page, not just the card. `null` when it cannot load.
 */
export function loadSharp(load: () => Promise<{ default: Sharp }> = () => import("sharp")) {
  sharpLoad ??= load()
    .then((module) => module.default)
    .catch((error: unknown) => {
      console.error("OG images: sharp could not load; serving PNG cards", error);
      return null;
    });
  return sharpLoad;
}

/** Forgets the loaded sharp (tests). */
export function resetSharpForTests(): void {
  sharpLoad = null;
}

/**
 * Render an OG card to a compressed JPEG `Response`, or to the PNG `next/og` draws when sharp is
 * unavailable, so a card is always served.
 *
 * Requires the Node.js runtime; the route that uses this must declare `export const runtime =
 * "nodejs"`.
 */
export async function renderOgJpeg(
  element: ReactElement,
  { quality = DEFAULT_JPEG_QUALITY }: { quality?: number } = {},
): Promise<Response> {
  const png = await new ImageResponse(element, { ...OG_IMAGE_SIZE }).arrayBuffer();
  const sharp = await loadSharp();
  if (!sharp) {
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": OG_FALLBACK_CACHE_CONTROL },
    });
  }
  const jpeg = await sharp(Buffer.from(png)).jpeg({ quality, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": OG_IMAGE_CONTENT_TYPE,
      "Cache-Control": OG_CACHE_CONTROL,
    },
  });
}
