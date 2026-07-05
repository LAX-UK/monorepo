import type { MediaAssetRecord } from "@auction/persistence/interfaces";
import type { GalleryImage } from "@auction/types";

export interface IMediaAssetEnricher {
  lookupByKeys(keys: readonly string[]): Promise<Map<string, MediaAssetRecord>>;

  buildGalleryImages(
    keys: readonly string[],
    resolvedUrls: readonly string[],
  ): Promise<GalleryImage[] | undefined>;

  buildGalleryImagesWithLookup(
    keys: readonly string[],
    resolvedUrls: readonly string[],
    lookup: Map<string, MediaAssetRecord>,
  ): GalleryImage[] | undefined;
}
