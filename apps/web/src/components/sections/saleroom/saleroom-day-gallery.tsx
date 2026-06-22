"use client";

import { MediaLightbox } from "@/components/gallery/engine/media-lightbox";
import type { DayGalleryVM } from "@/components/sections/saleroom/view-models";
import { MediaImage } from "@/components/ui/media-image";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import type { SaleDayMedia } from "@auction/types";
import { cn } from "@auction/ui";
import { PlayCircleIcon } from "lucide-react";
import { useState } from "react";

type Props = {
  vm: DayGalleryVM;
  className?: string;
};

// Thumbnail for a single grid item — image or video.
function DayMediaThumbnail({
  item,
  index,
  saleTitle,
  onClick,
}: {
  item: SaleDayMedia;
  index: number;
  saleTitle: string;
  onClick: () => void;
}) {
  const isVideo = item.mediaType === "video";
  const label = isVideo
    ? `Play video ${index + 1}${item.caption ? `: ${item.caption}` : ""}`
    : `Open photo ${index + 1}: ${
        item.mediaType === "image"
          ? (item.alt ?? item.caption ?? `Auction day photo ${index + 1}`)
          : ""
      }`;

  return (
    <button
      type="button"
      className={cn(
        "group relative w-full overflow-hidden rounded-lg bg-surface-container-low",
        FOCUS_RING,
      )}
      aria-label={label}
      onClick={onClick}
    >
      <div className="aspect-square w-full overflow-hidden">
        {isVideo ? (
          // Video thumbnail: show poster image if available, else dark placeholder.
          item.posterSrc ? (
            <MediaImage
              src={item.posterSrc}
              alt={item.caption ?? `Auction day video ${index + 1}`}
              label="Video thumbnail"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-container">
              <PlayCircleIcon className="size-12 text-on-surface-variant/60" aria-hidden />
            </div>
          )
        ) : (
          <MediaImage
            src={item.src}
            alt={item.alt ?? `${saleTitle} — auction day photo ${index + 1}`}
            label="Auction day photo"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="h-full w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
            {...(item.width ? { width: item.width } : {})}
            {...(item.height ? { height: item.height } : {})}
            {...(item.blurDataURL ? { blurDataURL: item.blurDataURL } : {})}
            priority={index === 0}
          />
        )}
      </div>

      {/* Video play badge */}
      {isVideo ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="rounded-full bg-black/55 p-3 backdrop-blur-sm transition-transform duration-200 motion-safe:group-hover:scale-110">
            <PlayCircleIcon className="size-8 text-white" />
          </div>
        </div>
      ) : null}

      {/* Caption */}
      {item.caption ? (
        <p
          className="px-2 pb-2 pt-1.5 font-body text-xs leading-snug text-on-surface-variant"
          aria-hidden="true"
        >
          {item.caption}
        </p>
      ) : null}
    </button>
  );
}

export function SaleroomDayGallery({ vm, className }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);
  const reduceMotion = useReducedMotion();
  const hasVideos = vm.items.some((i) => i.mediaType === "video");
  const animation = reduceMotion ? { fade: 0, swipe: 0 } : { fade: 250, swipe: 300 };

  return (
    <>
      <div className={cn("space-y-4", className)}>
        <h2 className="font-headline text-2xl font-semibold text-on-surface">Auction day</h2>
        <p className="font-body text-sm text-on-surface-variant">
          {hasVideos
            ? "Photos and videos from the saleroom floor."
            : "Photographs from the saleroom floor."}
        </p>
        <ol
          className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4"
          aria-label={hasVideos ? "Auction day photos and videos" : "Auction day photographs"}
        >
          {vm.items.map((item, index) => (
            <li key={`${item.src}-${index}`}>
              <DayMediaThumbnail
                item={item}
                index={index}
                saleTitle={vm.saleTitle}
                onClick={() => setLightboxIndex(index)}
              />
            </li>
          ))}
        </ol>
      </div>

      <MediaLightbox
        items={vm.items}
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(-1)}
        onIndexChange={setLightboxIndex}
        animation={animation}
      />
    </>
  );
}
