import type { SaleDayMedia } from "@auction/types";

export const DAY_GALLERY_INLINE_PREVIEW = 11;
export const DAY_GALLERY_INLINE_MAX = DAY_GALLERY_INLINE_PREVIEW + 1;

export type DayGalleryPreviewSplit = {
  previewItems: SaleDayMedia[];
  overflowCount: number;
  total: number;
  showViewAll: boolean;
};

export function splitDayGalleryPreview(items: SaleDayMedia[]): DayGalleryPreviewSplit {
  const total = items.length;
  const usePreview = total > DAY_GALLERY_INLINE_MAX;
  const overflowCount = usePreview ? total - DAY_GALLERY_INLINE_PREVIEW : 0;

  return {
    previewItems: usePreview ? items.slice(0, DAY_GALLERY_INLINE_PREVIEW) : items,
    overflowCount,
    total,
    showViewAll: usePreview,
  };
}

export function dayGalleryHasVideos(items: SaleDayMedia[]): boolean {
  return items.some((item) => item.mediaType === "video");
}

export function formatDayGallerySubtitle(total: number, hasVideos: boolean): string {
  if (total <= 1) {
    return hasVideos
      ? "Photo or video from the saleroom floor."
      : "Photograph from the saleroom floor.";
  }

  const noun = hasVideos ? "photos and videos" : "photographs";
  return `${total} ${noun} from the saleroom floor.`;
}

export function dayGalleryGridAriaLabel(hasVideos: boolean): string {
  return hasVideos ? "Auction day photos and videos" : "Auction day photographs";
}
