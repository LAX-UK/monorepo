"use client";

import { useGalleryContext } from "@/components/gallery/context/gallery-context";
import { GALLERY_MEDIA_PLACEHOLDER_LABEL } from "@/components/gallery/parts/gallery-media-placeholder";
import { MediaImage } from "@/components/ui/media-image";
import { Button, cn } from "@auction/ui";
import { useEffect, useRef } from "react";

/** Horizontal thumbnail strip with active-thumb auto-center. */
export function Filmstrip({ className }: { className?: string }) {
  const { images, index, setIndex } = useGalleryContext();
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-center when `index` changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [index]);

  if (images.length <= 1) return null;

  return (
    <div
      className={cn(
        "max-w-full shrink-0 border-t border-white/10 bg-surface-container-low/40 px-3 py-3",
        className,
      )}
      aria-label="Image thumbnails"
    >
      <div className="snap-x snap-mandatory overflow-x-auto pb-1 [scrollbar-width:thin]">
        <div className="mx-auto flex w-max gap-2.5">
          {images.map((img, i) => (
            <Button
              key={`thumb-${img.src}__${i}`}
              ref={i === index ? activeRef : undefined}
              type="button"
              variant="ghost"
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "relative h-16 w-16 shrink-0 snap-center overflow-hidden rounded-md p-0 hover:bg-transparent lg:h-[72px] lg:w-[72px]",
                "ring-2 ring-offset-2 ring-offset-surface-container-lowest transition-shadow",
                i === index ? "ring-primary" : "ring-transparent hover:ring-outline-variant/30",
              )}
            >
              <MediaImage
                src={img.src}
                alt=""
                label={GALLERY_MEDIA_PLACEHOLDER_LABEL}
                sizes="72px"
              />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
