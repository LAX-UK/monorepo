"use client";

import { MediaImage } from "@/components/ui/media-image";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

export type DayGalleryOverflowTileProps = {
  overflowCount: number;
  total: number;
  hasVideos: boolean;
  /** Optional preview image shown blurred beneath the overlay. */
  backgroundSrc?: string | null;
  onClick: () => void;
};

export function DayGalleryOverflowTile({
  overflowCount,
  total,
  hasVideos,
  backgroundSrc,
  onClick,
}: DayGalleryOverflowTileProps) {
  const mediaNoun = hasVideos ? "photos and videos" : "photographs";

  return (
    <button
      type="button"
      className={cn(
        "group relative aspect-square w-full overflow-hidden rounded-lg bg-surface-container",
        FOCUS_RING,
      )}
      aria-label={`View all ${total} auction day ${mediaNoun}`}
      onClick={onClick}
    >
      {backgroundSrc ? (
        <MediaImage
          src={backgroundSrc}
          alt=""
          label="More auction day media"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-sm"
          aria-hidden
        />
      ) : null}

      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 px-3 text-center">
        <span className="font-headline text-2xl font-semibold text-white">+{overflowCount}</span>
        <span className="mt-1 font-body text-xs font-medium uppercase tracking-wide text-white/90">
          more
        </span>
      </div>
    </button>
  );
}
