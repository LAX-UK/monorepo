"use client";

import { MediaImage } from "@/components/ui/media-image";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import type { SaleDayMedia } from "@auction/types";
import { cn } from "@auction/ui";
import { PlayCircleIcon } from "lucide-react";

export type DayMediaThumbnailVariant = "inline" | "sheet";

export type DayMediaThumbnailProps = {
  item: SaleDayMedia;
  index: number;
  total: number;
  saleTitle: string;
  variant?: DayMediaThumbnailVariant;
  onClick: () => void;
};

function thumbnailLabel(
  item: SaleDayMedia,
  index: number,
  total: number,
  saleTitle: string,
): string {
  const position = `${index + 1} of ${total}`;
  if (item.mediaType === "video") {
    return `Play video ${position}${item.caption ? `: ${item.caption}` : ""}`;
  }

  const alt =
    item.mediaType === "image"
      ? (item.alt ?? item.caption ?? `Auction day photo ${index + 1}`)
      : "";
  return `Open photo ${position}: ${alt || `${saleTitle} — auction day photo ${index + 1}`}`;
}

export function DayMediaThumbnail({
  item,
  index,
  total,
  saleTitle,
  variant = "inline",
  onClick,
}: DayMediaThumbnailProps) {
  const isVideo = item.mediaType === "video";
  const isSheet = variant === "sheet";
  const imageSizes = isSheet ? "120px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

  return (
    <button
      type="button"
      className={cn(
        "group relative w-full overflow-hidden bg-surface-container-low",
        isSheet ? "rounded-md" : "rounded-lg",
        FOCUS_RING,
      )}
      aria-label={thumbnailLabel(item, index, total, saleTitle)}
      onClick={onClick}
    >
      <div className="aspect-square w-full overflow-hidden">
        {isVideo ? (
          item.posterSrc ? (
            <MediaImage
              src={item.posterSrc}
              alt={item.caption ?? `Auction day video ${index + 1}`}
              label="Video thumbnail"
              sizes={imageSizes}
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
            sizes={imageSizes}
            className={cn(
              "h-full w-full object-cover",
              !isSheet &&
                "transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03] motion-reduce:group-hover:scale-100",
            )}
            {...(item.width ? { width: item.width } : {})}
            {...(item.height ? { height: item.height } : {})}
            {...(item.blurDataURL ? { blurDataURL: item.blurDataURL } : {})}
            priority={!isSheet && index === 0}
          />
        )}
      </div>

      {isVideo ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <div
            className={cn(
              "rounded-full bg-black/55 backdrop-blur-sm transition-transform duration-200 motion-safe:group-hover:scale-110",
              isSheet ? "p-2" : "p-3",
            )}
          >
            <PlayCircleIcon className={cn("text-white", isSheet ? "size-6" : "size-8")} />
          </div>
        </div>
      ) : null}

      {!isSheet && item.caption ? (
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
