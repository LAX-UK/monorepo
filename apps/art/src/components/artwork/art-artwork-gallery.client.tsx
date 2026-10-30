"use client";

import { ArtMediaImage } from "@/components/media/art-media-image";
import { ARTWORK_STAGE_RATIO, clampArtworkStageRatio } from "@/lib/artwork/artwork-detail.vm";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { useRef, useState } from "react";

export type ArtworkGalleryImage = {
  url: string;
  alt: string;
};

type Props = {
  images: ArtworkGalleryImage[];
  /** Width-to-height ratio from the work's size, used until the image has loaded. */
  stageRatio?: number | null;
  priority?: boolean;
};

/**
 * Desktop gallery (Figma 426:2581): a square-cornered stage shaped like the work, so portrait,
 * square and landscape works each sit in a frame made for them (the ratio is kept between 3:4
 * and 16:10, so only extreme formats get a narrow mat), with thumbnails below.
 */
export function ArtArtworkGallery({ images, stageRatio = null, priority = false }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const active = images[activeIndex] ?? images[0];
  if (!active) return null;
  // The loaded image's shape leads, since it is what the stage shows; the work's size holds
  // the frame until the image arrives, so there is little to no shift; a portrait frame otherwise.
  const ratio = imageRatio ?? stageRatio ?? ARTWORK_STAGE_RATIO.min;

  return (
    <div className="flex flex-col gap-3" data-testid="art-artwork-gallery">
      <div
        className="marketing-work-mat relative max-h-[min(85vh,56rem)] overflow-hidden"
        style={{ aspectRatio: String(ratio) }}
        data-testid="art-artwork-stage"
      >
        <ArtMediaImage
          src={active.url}
          alt={active.alt}
          sizes="(min-width: 64rem) 55vw, 100vw"
          label={ART_MEDIA_LABELS.artwork}
          priority={priority}
          className="absolute inset-0 size-full"
          imgClassName="object-contain"
          imgRef={imgRef}
          onImageLoad={() => {
            const img = imgRef.current;
            if (img?.naturalWidth && img.naturalHeight) {
              setImageRatio(clampArtworkStageRatio(img.naturalWidth / img.naturalHeight));
            }
          }}
        />
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Gallery thumbnails">
          {images.map((image, index) => (
            <li key={image.url}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-pressed={index === activeIndex}
                className={cn(
                  "relative h-24 w-20 shrink-0 overflow-hidden rounded-none border-2 p-0",
                  index === activeIndex ? "border-on-surface" : "border-transparent",
                )}
              >
                <ArtMediaImage
                  src={image.url}
                  alt=""
                  aspect={[5, 6]}
                  sizes="5rem"
                  label={ART_MEDIA_LABELS.artwork}
                  className="absolute inset-0 size-full"
                  imgClassName="object-cover"
                />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
