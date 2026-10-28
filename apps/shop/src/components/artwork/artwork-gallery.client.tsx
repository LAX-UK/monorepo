"use client";

import { ArtworkImageViewer } from "@/components/artwork/artwork-image-viewer.client";
import { ArtworkScaleFigure } from "@/components/artwork/artwork-scale-figure";
import { ShopMediaImage } from "@/components/media/shop-media-image";
import type { ArtworkGalleryVm } from "@/lib/artwork/artwork-product-page.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import {
  MarketingCarouselNextIcon,
  MarketingCarouselPreviousIcon,
  MarketingExpandIcon,
  MarketingRulerIcon,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";

const SWIPE_THRESHOLD_PX = 48;

type Slide = { kind: "image"; imageIndex: number } | { kind: "scale" };

/**
 * The product gallery: every photograph on a neutral mat, uncropped, then a to-scale drawing when
 * the size is known. Thumbnails choose a slide (arrow keys move between them); the stage swipes on
 * touch; a photograph opens full screen with zoom.
 */
export function ArtworkGallery({ title, gallery }: { title: string; gallery: ArtworkGalleryVm }) {
  const slides: Slide[] = [
    ...gallery.images.map((_, imageIndex) => ({ kind: "image" as const, imageIndex })),
    ...(gallery.scale ? [{ kind: "scale" as const }] : []),
  ];
  const [active, setActive] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const slide = slides[active] ?? slides[0];
  const count = slides.length;
  const primaryImageUrl = gallery.images[0]?.url ?? null;

  const select = (index: number) => setActive((index + count) % count);

  function onThumbKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? index + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? count - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    const target = (next + count) % count;
    select(target);
    thumbRefs.current[target]?.focus();
  }

  function onStagePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") return;
    swipe.current = { x: event.clientX, y: event.clientY };
  }

  function onStagePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || count < 2) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      select(active + (dx < 0 ? 1 : -1));
    }
  }

  if (!slide) {
    return (
      <div className="shop-gallery">
        <div className="shop-gallery__stage marketing-work-mat">
          <ShopMediaImage
            src={null}
            alt={title}
            label={SHOP_MEDIA_LABELS.artwork}
            className="absolute inset-0 size-full"
          />
        </div>
      </div>
    );
  }

  const activeImage = slide.kind === "image" ? gallery.images[slide.imageIndex] : undefined;
  const slideLabel = (item: Slide, index: number) =>
    item.kind === "scale" ? "View to scale" : `Image ${index + 1} of ${gallery.images.length}`;

  return (
    <section className="shop-gallery" aria-label={`Images of ${title}`}>
      <div
        className="shop-gallery__stage marketing-work-mat"
        data-kind={slide.kind}
        onPointerDown={onStagePointerDown}
        onPointerUp={onStagePointerUp}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        {activeImage ? (
          <div className="shop-gallery__mat">
            <ShopMediaImage
              key={activeImage.url}
              src={activeImage.url}
              alt={activeImage.alt}
              label={SHOP_MEDIA_LABELS.artwork}
              sizes="(min-width: 64rem) 52vw, 100vw"
              priority={active === 0}
              className="absolute inset-0 size-full"
              imgClassName="object-contain"
            />
          </div>
        ) : gallery.scale ? (
          <ArtworkScaleFigure scale={gallery.scale} imageUrl={primaryImageUrl} />
        ) : null}

        {activeImage ? (
          <Button
            type="button"
            variant="ghost"
            className="shop-gallery__control shop-gallery__expand shop-focus-ring"
            aria-label="View full screen"
            aria-haspopup="dialog"
            onClick={() => setViewerOpen(true)}
          >
            <MarketingExpandIcon />
          </Button>
        ) : null}

        {count > 1 ? (
          <div className="shop-gallery__arrows">
            <Button
              type="button"
              variant="ghost"
              className="shop-gallery__control shop-focus-ring"
              aria-label="Previous image"
              onClick={() => select(active - 1)}
            >
              <MarketingCarouselPreviousIcon className="size-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="shop-gallery__control shop-focus-ring"
              aria-label="Next image"
              onClick={() => select(active + 1)}
            >
              <MarketingCarouselNextIcon className="size-5" />
            </Button>
          </div>
        ) : null}
      </div>

      {count > 1 ? (
        <ul className="shop-gallery__thumbs" aria-label="Choose an image">
          {slides.map((item, index) => {
            const image = item.kind === "image" ? gallery.images[item.imageIndex] : undefined;
            const selected = index === active;
            return (
              <li key={image?.url ?? "scale"}>
                <Button
                  ref={(element) => {
                    thumbRefs.current[index] = element;
                  }}
                  type="button"
                  variant="ghost"
                  className={cn("shop-gallery__thumb shop-focus-ring", selected && "is-selected")}
                  aria-label={slideLabel(item, index)}
                  aria-current={selected ? "true" : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(index)}
                  onKeyDown={(event) => onThumbKeyDown(event, index)}
                >
                  {image ? (
                    <ShopMediaImage
                      src={image.url}
                      alt=""
                      label={SHOP_MEDIA_LABELS.artwork}
                      sizes="4.5rem"
                      className="absolute inset-0 size-full"
                      imgClassName="object-contain"
                    />
                  ) : (
                    <span className="shop-gallery__thumb-scale">
                      <MarketingRulerIcon />
                      <span>Scale</span>
                    </span>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {gallery.images.length > 0 ? (
        <ArtworkImageViewer
          title={title}
          images={gallery.images}
          index={activeImage && slide.kind === "image" ? slide.imageIndex : 0}
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          onIndexChange={(imageIndex) => setActive(imageIndex)}
        />
      ) : null}
    </section>
  );
}
