import type { MediaAssetRecord } from "@auction/persistence/interfaces";
import type { GalleryImage, Sale, SaleCoverSlotAssets } from "@auction/types";

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

  /**
   * The cover slots of each sale with their sizes and measured scrim, by sale id. Optional so an
   * enricher that only knows pictures (a test double) still fits; the presenters skip it then.
   */
  buildCoverSlotAssets?(
    sales: readonly Pick<Sale, "id" | "title" | "coverSlots" | "coverImages">[],
    resolve: (key: string) => string,
  ): Promise<Map<string, SaleCoverSlotAssets>>;
}
