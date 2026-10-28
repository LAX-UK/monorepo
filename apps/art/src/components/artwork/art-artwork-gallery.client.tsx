"use client";

import { ArtMediaImage } from "@/components/media/art-media-image";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { useState } from "react";

export type ArtworkGalleryImage = {
  url: string;
  alt: string;
};

type Props = {
  images: ArtworkGalleryImage[];
  priority?: boolean;
};

/** Desktop gallery: square-cornered portrait frame with thumbnails below (Figma 426:2581). */
export function ArtArtworkGallery({ images, priority = false }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];
  if (!active) return null;

  return (
    <div className="flex flex-col gap-3" data-testid="art-artwork-gallery">
      <div className="marketing-work-mat relative aspect-[3/4] overflow-hidden">
        <ArtMediaImage
          src={active.url}
          alt={active.alt}
          aspect={[3, 4]}
          sizes="(min-width: 64rem) 55vw, 100vw"
          label={ART_MEDIA_LABELS.artwork}
          priority={priority}
          className="absolute inset-0 size-full"
          imgClassName="object-contain"
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
