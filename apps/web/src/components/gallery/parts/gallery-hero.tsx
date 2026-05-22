"use client";

import { useGalleryContext } from "@/components/gallery/context/gallery-context";
import { GALLERY_MEDIA_PLACEHOLDER_LABEL } from "@/components/gallery/parts/gallery-media-placeholder";
import { MediaImage } from "@/components/ui/media-image";
import { Carousel, type CarouselApi, CarouselContent, CarouselItem } from "@auction/ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@auction/ui/components/tooltip";
import { Maximize2 } from "lucide-react";

type Props = {
  setCarouselApi: (api: CarouselApi) => void;
  className?: string;
};

/** Full-bleed Embla hero with expand control. */
export function GalleryHero({ setCarouselApi, className }: Props) {
  const { images, index, openLightbox, openViewAll, priorityIndices } = useGalleryContext();
  const hasMany = images.length > 1;
  const current = images[index] ?? images[0];

  if (!current) {
    return (
      <MediaImage
        src={null}
        alt=""
        label={GALLERY_MEDIA_PLACEHOLDER_LABEL}
        tone="auto"
        className="h-full min-h-[240px] w-full"
      />
    );
  }

  if (!hasMany) {
    return (
      <SingleHero image={current} onExpand={openLightbox} {...(className ? { className } : {})} />
    );
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div className={cn("group relative min-h-0 flex-1 touch-pan-y", className)}>
        <Carousel
          opts={{ align: "start", containScroll: "trimSnaps", loop: true }}
          setApi={setCarouselApi}
          className="h-full"
          aria-label="Lot images"
        >
          <CarouselContent className="-ml-0 h-full" viewportClassName="h-full">
            {images.map((img, i) => (
              <CarouselItem key={`${img.src}__${i}`} className="h-full basis-full pl-0">
                <MediaImage
                  src={img.src}
                  alt={img.alt ?? ""}
                  label={GALLERY_MEDIA_PLACEHOLDER_LABEL}
                  priority={priorityIndices.has(i)}
                  imgClassName="cursor-zoom-in bg-surface-container-low object-contain transition-transform duration-1000 motion-safe:group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  onClick={openLightbox}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="pointer-events-none absolute inset-0 bg-black/5 opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none" />
        <HeroExpandButton onExpand={openLightbox} />
        {images.length >= 6 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="pointer-events-auto absolute bottom-6 right-28 hidden font-label text-xs font-bold uppercase tracking-wide text-on-surface underline-offset-2 hover:underline sm:inline-flex"
            onClick={openViewAll}
          >
            All {images.length} images
          </Button>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function SingleHero({
  image,
  onExpand,
  className,
}: {
  image: { src: string; alt?: string };
  onExpand: () => void;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={400}>
      <div className={cn("group relative min-h-0 flex-1", className)}>
        <MediaImage
          src={image.src}
          alt={image.alt ?? ""}
          label={GALLERY_MEDIA_PLACEHOLDER_LABEL}
          priority
          imgClassName="cursor-zoom-in bg-surface-container-low transition-transform duration-1000 motion-safe:group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 lg:object-contain"
          sizes="(min-width: 1024px) 58vw, 100vw"
          onClick={onExpand}
        />
        <HeroExpandButton onExpand={onExpand} />
      </div>
    </TooltipProvider>
  );
}

function HeroExpandButton({ onExpand }: { onExpand: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-lightbox-opener="true"
          onClick={onExpand}
          className="pointer-events-auto absolute bottom-6 right-6 h-auto rounded-md bg-surface-container-lowest/90 px-3 py-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface shadow-md backdrop-blur-sm hover:bg-primary hover:text-on-primary"
        >
          <Maximize2 className="size-4" aria-hidden />
          Expand
        </Button>
      </TooltipTrigger>
      <TooltipContent>Open fullscreen view</TooltipContent>
    </Tooltip>
  );
}
