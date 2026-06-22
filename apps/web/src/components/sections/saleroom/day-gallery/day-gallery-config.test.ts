import {
  DAY_GALLERY_INLINE_MAX,
  DAY_GALLERY_INLINE_PREVIEW,
  dayGalleryHasVideos,
  formatDayGallerySubtitle,
  splitDayGalleryPreview,
} from "@/components/sections/saleroom/day-gallery/day-gallery-config";
import type { SaleDayMedia } from "@auction/types";
import { describe, expect, it } from "vitest";

function imageItem(index: number): SaleDayMedia {
  return {
    mediaType: "image",
    src: `uploads/day-${index}.jpg`,
    alt: `Photo ${index}`,
  };
}

function buildItems(count: number): SaleDayMedia[] {
  return Array.from({ length: count }, (_, index) => imageItem(index + 1));
}

describe("splitDayGalleryPreview", () => {
  it("shows all items when total is at or below the inline max", () => {
    expect(splitDayGalleryPreview(buildItems(5))).toEqual({
      previewItems: buildItems(5),
      overflowCount: 0,
      total: 5,
      showViewAll: false,
    });

    expect(splitDayGalleryPreview(buildItems(DAY_GALLERY_INLINE_MAX))).toMatchObject({
      previewItems: buildItems(DAY_GALLERY_INLINE_MAX),
      overflowCount: 0,
      showViewAll: false,
    });
  });

  it("splits into preview and overflow when total exceeds the inline max", () => {
    const items = buildItems(13);
    const split = splitDayGalleryPreview(items);

    expect(split.previewItems).toHaveLength(DAY_GALLERY_INLINE_PREVIEW);
    expect(split.overflowCount).toBe(2);
    expect(split.total).toBe(13);
    expect(split.showViewAll).toBe(true);
  });

  it("handles large sets with correct overflow count", () => {
    const split = splitDayGalleryPreview(buildItems(30));

    expect(split.previewItems).toHaveLength(DAY_GALLERY_INLINE_PREVIEW);
    expect(split.overflowCount).toBe(19);
    expect(split.showViewAll).toBe(true);
  });
});

describe("formatDayGallerySubtitle", () => {
  it("uses singular copy for a single item", () => {
    expect(formatDayGallerySubtitle(1, false)).toBe("Photograph from the saleroom floor.");
    expect(formatDayGallerySubtitle(1, true)).toBe("Photo or video from the saleroom floor.");
  });

  it("includes total count for multiple items", () => {
    expect(formatDayGallerySubtitle(30, false)).toBe("30 photographs from the saleroom floor.");
    expect(formatDayGallerySubtitle(30, true)).toBe(
      "30 photos and videos from the saleroom floor.",
    );
  });
});

describe("dayGalleryHasVideos", () => {
  it("detects video items", () => {
    expect(dayGalleryHasVideos([imageItem(1)])).toBe(false);
    expect(
      dayGalleryHasVideos([
        imageItem(1),
        { mediaType: "video", src: "uploads/clip.mp4", posterSrc: "uploads/poster.jpg" },
      ]),
    ).toBe(true);
  });
});
