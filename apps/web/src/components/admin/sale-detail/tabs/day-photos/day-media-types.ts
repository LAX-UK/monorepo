import type { SaleDayMediaRef } from "@auction/types";

export const ACCEPT_ALL = "image/jpeg,image/png,image/webp,video/mp4,video/webm";
export const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp";
export const ACCEPT_VIDEOS = "video/mp4,video/webm";

export type DayMediaItem = {
  id: string;
  key: string;
  mediaType: "image" | "video";
  previewUrl: string;
  caption: string;
  alt: string;
  uploading?: boolean;
  uploadError?: string;
};

export function refToItem(
  ref: SaleDayMediaRef,
  previewUrlByKey: Record<string, string>,
): DayMediaItem {
  const mediaType = ref.mediaType === "video" ? "video" : "image";
  return {
    id: ref.key,
    key: ref.key,
    mediaType,
    previewUrl: previewUrlByKey[ref.key] ?? ref.key,
    caption: ref.caption ?? "",
    alt: ref.mediaType !== "video" && ref.alt ? ref.alt : "",
  };
}

export function itemsToDayImages(items: DayMediaItem[]): SaleDayMediaRef[] {
  return items
    .filter((it) => it.key && !it.uploadError)
    .map((it) => {
      if (it.mediaType === "video") {
        const ref: import("@auction/types").SaleDayVideoRef = { mediaType: "video", key: it.key };
        if (it.caption.trim()) ref.caption = it.caption.trim();
        return ref;
      }
      const ref: import("@auction/types").SaleDayPhotoRef = { key: it.key };
      if (it.caption.trim()) ref.caption = it.caption.trim();
      if (it.alt.trim()) ref.alt = it.alt.trim();
      return ref;
    });
}
