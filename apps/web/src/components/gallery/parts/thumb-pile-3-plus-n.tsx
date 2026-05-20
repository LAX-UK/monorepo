"use client";

import { MediaImage } from "@/components/ui/media-image";
import type { GalleryImage, PositionIndicatorProps } from "@auction/types";
import { Button, cn } from "@auction/ui";

const MAX_VISIBLE = 3;
const TAP_MIN = "min-h-11 min-w-11";

type Props = PositionIndicatorProps & {
  images: GalleryImage[];
};

/** Windowed mini-thumb pile: at most 3 circles + "+N" for the rest. */
export function ThumbPile3PlusN({ images, total, index, onSelect, onOverflow, className }: Props) {
  if (total <= 1) return null;

  if (total <= MAX_VISIBLE) {
    return (
      <div
        className={cn("pointer-events-auto flex gap-1", className)}
        role="group"
        aria-label="Image position"
      >
        {images.map((img, i) => (
          <ThumbDot
            key={`${img.src}__${i}`}
            image={img}
            i={i}
            total={total}
            active={i === index}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  const windowIndices = windowedIndices(index, total, MAX_VISIBLE);
  const overflowCount = total - MAX_VISIBLE;

  return (
    <div
      className={cn("pointer-events-auto flex items-center gap-1", className)}
      role="group"
      aria-label="Image position"
    >
      {windowIndices.map((i) => {
        const image = images[i];
        if (!image) return null;
        return (
          <ThumbDot
            key={`${image.src}__${i}`}
            image={image}
            i={i}
            total={total}
            active={i === index}
            onSelect={onSelect}
          />
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          TAP_MIN,
          "rounded-full bg-white/50 px-3 font-label text-xs font-bold text-on-surface hover:bg-white/80",
        )}
        aria-label={`View all ${total} images`}
        onClick={() => onOverflow?.()}
      >
        +{overflowCount}
      </Button>
    </div>
  );
}

function windowedIndices(current: number, total: number, max: number): number[] {
  if (total <= max) {
    return Array.from({ length: total }, (_, i) => i);
  }
  let start = Math.max(0, current - 1);
  if (start + max > total) start = total - max;
  return Array.from({ length: max }, (_, j) => start + j);
}

function ThumbDot({
  image,
  i,
  total,
  active,
  onSelect,
}: {
  image: GalleryImage;
  i: number;
  total: number;
  active: boolean;
  onSelect: (i: number) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Show image ${i + 1} of ${total}`}
      aria-current={active ? "true" : undefined}
      onClick={() => onSelect(i)}
      className={cn(
        TAP_MIN,
        "rounded-full p-0.5",
        active
          ? "bg-primary ring-2 ring-primary ring-offset-2 ring-offset-transparent"
          : "bg-white/50 hover:bg-white/80",
      )}
    >
      <span className="relative block size-6 overflow-hidden rounded-full">
        <MediaImage src={image.src} alt="" label="Thumbnail" sizes="24px" />
      </span>
    </Button>
  );
}
