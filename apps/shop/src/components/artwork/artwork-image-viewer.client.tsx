"use client";

import { ShopMediaImage } from "@/components/media/shop-media-image";
import type { ArtworkGalleryImageVm } from "@/lib/artwork/artwork-product-page.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import {
  MarketingCarouselNextIcon,
  MarketingCarouselPreviousIcon,
  MarketingZoomInIcon,
  MarketingZoomOutIcon,
} from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import { Dialog, DialogContent, DialogTitle } from "@auction/ui/components/dialog";
import { type PointerEvent, useEffect, useRef, useState } from "react";

const SWIPE_THRESHOLD_PX = 48;

type Props = {
  title: string;
  images: readonly ArtworkGalleryImageVm[];
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
};

/**
 * Full-screen view of the artwork's photographs. Fit shows the whole image; zoom shows it at twice
 * the screen width to look at paper and print, moved by dragging, scrolling or the arrow keys.
 * Left and right arrows (or a swipe) change image while fitted; Escape closes.
 */
export function ArtworkImageViewer({
  title,
  images,
  index,
  open,
  onOpenChange,
  onIndexChange,
}: Props) {
  const [zoomed, setZoomed] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const image = images[index] ?? images[0];
  const count = images.length;

  // A new image or a fresh open starts fitted.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the image or open state changes
  useEffect(() => {
    setZoomed(false);
    setRatio(null);
  }, [index, open]);

  // Zooming in centres the view on the middle of the image.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!zoomed || !scroller) return;
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
    scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
    scroller.focus();
  }, [zoomed]);

  if (!image) return null;

  const go = (offset: number) => onIndexChange((index + offset + count) % count);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const scroller = scrollRef.current;
    if (zoomed) {
      // Touch scrolls the zoomed image natively; a mouse drags it.
      if (event.pointerType !== "mouse" || !scroller) return;
      drag.current = {
        x: event.clientX,
        y: event.clientY,
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      swipe.current = { x: event.clientX, y: event.clientY };
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const scroller = scrollRef.current;
    if (!start || !scroller) return;
    scroller.scrollLeft = start.left - (event.clientX - start.x);
    scroller.scrollTop = start.top - (event.clientY - start.y);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    const start = swipe.current;
    swipe.current = null;
    if (!start || zoomed || count < 2) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="shop-viewer"
        overlayClassName="shop-viewer__overlay"
        closeClassName="shop-viewer__close"
        aria-describedby={undefined}
        onKeyDown={(event) => {
          if (zoomed || count < 2) return;
          if (event.key === "ArrowRight") {
            event.preventDefault();
            go(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            go(-1);
          }
        }}
      >
        <div className="shop-viewer__bar">
          <DialogTitle className="shop-viewer__title">
            {title}
            {count > 1 ? (
              <span className="shop-viewer__count">
                {" "}
                · Image {index + 1} of {count}
              </span>
            ) : null}
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            className="shop-viewer__control shop-focus-ring"
            aria-pressed={zoomed}
            onClick={() => setZoomed((value) => !value)}
          >
            {zoomed ? <MarketingZoomOutIcon /> : <MarketingZoomInIcon />}
            <span className="shop-viewer__control-label">
              {zoomed ? "Fit to screen" : "Zoom in"}
            </span>
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="shop-viewer__stage"
          data-zoomed={zoomed ? "true" : "false"}
          tabIndex={zoomed ? 0 : -1}
          aria-label={
            zoomed ? "Zoomed image. Drag or use the arrow keys to move around." : undefined
          }
          role={zoomed ? "region" : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            swipe.current = null;
          }}
        >
          <div
            className="shop-viewer__frame"
            style={zoomed && ratio ? { aspectRatio: `${ratio}` } : undefined}
          >
            <ShopMediaImage
              key={image.url}
              src={image.url}
              alt={image.alt}
              label={SHOP_MEDIA_LABELS.artwork}
              sizes={zoomed ? "200vw" : "100vw"}
              imgRef={imageRef}
              onImageLoad={() => {
                const element = imageRef.current;
                if (element?.naturalWidth && element.naturalHeight) {
                  setRatio(element.naturalWidth / element.naturalHeight);
                }
              }}
              className="absolute inset-0 size-full"
              imgClassName="object-contain"
            />
          </div>
        </div>

        {count > 1 ? (
          <div className="shop-viewer__nav">
            <Button
              type="button"
              variant="ghost"
              className="shop-viewer__control shop-viewer__control--icon shop-focus-ring"
              aria-label="Previous image"
              onClick={() => go(-1)}
            >
              <MarketingCarouselPreviousIcon className="size-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="shop-viewer__control shop-viewer__control--icon shop-focus-ring"
              aria-label="Next image"
              onClick={() => go(1)}
            >
              <MarketingCarouselNextIcon className="size-5" />
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
