import { resolveMediaSrc } from "@/lib/media/resolve-media-src";

export type PictureSize = { width: number; height: number };

/**
 * Reads a stored picture's pixel size by loading it, so the size floors can be checked before the
 * picture is saved. Resolves to null when the picture cannot be loaded.
 */
export function measurePicture(key: string): Promise<PictureSize | null> {
  const src = resolveMediaSrc(key);
  if (!src || typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
