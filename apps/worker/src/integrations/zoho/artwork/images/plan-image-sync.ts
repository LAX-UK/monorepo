import type { ZohoImageSource } from "@auction/artwork-register-contracts";
import type { RemoteProductImage } from "./zoho-product-image.js";

/** No artwork carries more pictures than this; the rest are ignored and counted. */
export const MAX_IMAGES_PER_ARTWORK = 12;

export type PlannedImage = {
  image: RemoteProductImage;
  /** The copy the register already holds for this exact Zoho file, or null when it must be fetched. */
  copied: ZohoImageSource | null;
};

export type ImageSyncPlan = {
  /** Zoho's pictures in Zoho's order. */
  items: PlannedImage[];
  /** Pictures beyond the limit that were left out. */
  ignored: number;
  /** Register pictures Zoho no longer lists. */
  removed: number;
};

/**
 * Compares what Zoho lists with what the register already copied. A picture is reused when its
 * Zoho file and fingerprint both match; anything else is fetched. Pure.
 */
export function planImageSync(
  remote: readonly RemoteProductImage[],
  current: readonly ZohoImageSource[],
): ImageSyncPlan {
  const kept = remote.slice(0, MAX_IMAGES_PER_ARTWORK);
  const byFile = new Map(current.map((source) => [source.zohoFileId, source]));
  const items = kept.map((image): PlannedImage => {
    const source = byFile.get(image.fileId);
    return { image, copied: source && source.fingerprint === image.fingerprint ? source : null };
  });
  const listed = new Set(kept.map((image) => image.fileId));
  return {
    items,
    ignored: remote.length - kept.length,
    removed: current.filter((source) => !listed.has(source.zohoFileId)).length,
  };
}
