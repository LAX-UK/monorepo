"use client";

import { useGalleryContext } from "@/components/gallery/context/gallery-context";
import { GALLERY_MEDIA_PLACEHOLDER_LABEL } from "@/components/gallery/parts/gallery-media-placeholder";
import { MediaImage } from "@/components/ui/media-image";
import { useOverlayTone } from "@/components/ui/overlay-tone-context";
import { overlayPillClasses, overlayToneProps } from "@/lib/ui/overlay-tone-classes";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@auction/ui";
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

const frostedNavArrowClasses =
  "pointer-events-auto top-1/2 hidden size-10 -translate-y-1/2 rounded-full border-[color:var(--overlay-border)] bg-[color:var(--overlay-bg)] text-[color:var(--overlay-fg)] opacity-0 shadow-md backdrop-blur-sm transition-opacity hover:opacity-100 group-hover:opacity-100 motion-reduce:transition-none md:flex disabled:pointer-events-none disabled:opacity-0";

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
          <HeroCarouselArrows />
        </Carousel>
        <div className="pointer-events-none absolute inset-0 bg-black/5 opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none" />
        <HeroControlsCluster
          imageCount={images.length}
          onExpand={openLightbox}
          onViewAll={openViewAll}
        />
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
        <HeroControlsCluster imageCount={1} onExpand={onExpand} />
      </div>
    </TooltipProvider>
  );
}

function HeroCarouselArrows() {
  const tone = useOverlayTone("bottomRight");

  return (
    <>
      <CarouselPrevious
        variant="ghost"
        className={cn(frostedNavArrowClasses, "!left-4")}
        {...overlayToneProps(tone)}
      />
      <CarouselNext
        variant="ghost"
        className={cn(frostedNavArrowClasses, "!right-4")}
        {...overlayToneProps(tone)}
      />
    </>
  );
}

function HeroControlsCluster({
  imageCount,
  onExpand,
  onViewAll,
}: {
  imageCount: number;
  onExpand: () => void;
  onViewAll?: () => void;
}) {
  const tone = useOverlayTone("bottomRight");
  const pillBase = cn(
    overlayPillClasses(tone),
    "pointer-events-auto inline-flex h-auto items-center gap-1.5 rounded-full px-3 py-1.5 font-label text-xs font-semibold uppercase tracking-wide shadow-md transition-opacity hover:opacity-90 motion-reduce:transition-none",
  );

  return (
    <div className="pointer-events-none absolute right-4 bottom-4 z-10 flex items-center gap-2">
      {imageCount >= 6 && onViewAll ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(pillBase, "hidden md:inline-flex")}
          {...overlayToneProps(tone)}
          onClick={onViewAll}
        >
          All {imageCount} images
        </Button>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-lightbox-opener="true"
            className={pillBase}
            {...overlayToneProps(tone)}
            onClick={onExpand}
          >
            <Maximize2 className="size-3.5" aria-hidden />
            Expand
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open fullscreen view</TooltipContent>
      </Tooltip>
    </div>
  );
}
