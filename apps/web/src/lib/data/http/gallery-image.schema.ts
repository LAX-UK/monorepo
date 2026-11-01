import { isIndexableObject } from "@/lib/data/http/object-guards";
import type { GalleryImage } from "@auction/types";

/** Reads the enriched image list an API payload carries beside a list of image URLs. */
export function parseGalleryImages(raw: unknown): GalleryImage[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: GalleryImage[] = [];
  for (const entry of raw) {
    if (!isIndexableObject(entry)) continue;
    const src =
      typeof entry.src === "string" ? entry.src : typeof entry.url === "string" ? entry.url : null;
    if (!src) continue;
    const image: GalleryImage = { src };
    if (typeof entry.alt === "string" && entry.alt.trim()) image.alt = entry.alt.trim();
    if (typeof entry.width === "number") image.width = entry.width;
    if (typeof entry.height === "number") image.height = entry.height;
    if (typeof entry.blurDataURL === "string" && entry.blurDataURL)
      image.blurDataURL = entry.blurDataURL;
    out.push(image);
  }
  return out.length > 0 ? out : undefined;
}
