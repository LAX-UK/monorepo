"use client";

import { MediaImage } from "@/components/ui/media-image";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import type { GalleryImage } from "@auction/types";
import { Button } from "@auction/ui/lax/button";
import { cn } from "@auction/ui/lib/utils";
import { Maximize2, ZoomIn } from "lucide-react";

export const NO_IMAGE_LABEL = "No image yet";

/** What every presentation of a lot's pictures is given by the container. */
export type LotMediaViewProps = {
  title: string;
  images: GalleryImage[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Opens the full-screen viewer, with zoom, at a picture (the current one by default). */
  onOpenViewer: (index?: number) => void;
  /** The word for the strip of thumbnails; null where there is none. */
  stripLabel: string | null;
};

/** The plain ground a studio-lit piece sits on (shared with the lot cards). */
export const STUDIO_GROUND = "bg-[var(--color-studio-ground)]";

/** The stage box: edge to edge on a phone, rounded and square on a desk. */
export const STAGE_BOX = "relative -mx-4 md:mx-0 md:rounded-xl";

export function ViewerButton({
  onClick,
  zoom = false,
  className,
}: { onClick: () => void; zoom?: boolean; className?: string }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      icon={zoom ? <ZoomIn aria-hidden /> : <Maximize2 aria-hidden />}
      onClick={onClick}
      aria-haspopup="dialog"
      className={cn("absolute right-4 bottom-4", className)}
    >
      {zoom ? "Zoom" : "View larger"}
    </Button>
  );
}

export function EmptyStage({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn(STAGE_BOX, "aspect-[5/4] md:aspect-square", className)}>
      <MediaPlaceholder fill label={NO_IMAGE_LABEL} title={title} className="md:rounded-xl" />
    </div>
  );
}

/**
 * The strip of thumbnails under a stage: a button for each picture, the current one ringed. The
 * label names the strip for assistive technology ("Angles", "Pages").
 */
export function LotMediaStrip({
  images,
  index,
  onSelect,
  label,
  fit,
}: {
  images: GalleryImage[];
  index: number;
  onSelect: (index: number) => void;
  label: string | null;
  fit: "contain" | "cover";
}) {
  if (!label || images.length < 2) return null;
  const noun = label === "Pages" ? "Page" : "Image";
  return (
    <ul className="mt-3 flex list-none gap-2 overflow-x-auto p-0 pb-1" aria-label={label}>
      {images.map((image, i) => (
        <li key={image.src}>
          <Button
            variant="ghost"
            aria-label={`${noun} ${i + 1} of ${images.length}`}
            aria-current={i === index ? "true" : undefined}
            onClick={() => onSelect(i)}
            className={cn(
              "size-16 overflow-hidden rounded-md bg-lax-paper hover:bg-lax-paper",
              fit === "contain" ? "p-2.5" : "p-0",
              "ring-1 ring-lax-line ring-inset hover:ring-lax-line-hover",
              "aria-[current=true]:ring-2 aria-[current=true]:ring-lax-fg",
            )}
          >
            <span className="relative block size-full">
              <MediaImage
                src={image.src}
                alt=""
                sizes="64px"
                className="overflow-visible"
                imgClassName={fit === "contain" ? "object-contain" : "object-cover"}
              />
            </span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
