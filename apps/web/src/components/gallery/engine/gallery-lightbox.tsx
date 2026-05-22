"use client";

import { GalleryMediaPlaceholder } from "@/components/gallery/parts/gallery-media-placeholder";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import type { GalleryImage } from "@auction/types";
import { useEffect, useMemo } from "react";
import Lightbox, { type Plugin } from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

const DEFAULT_PLUGINS = [Zoom, Thumbnails, Counter, Fullscreen, Captions];

const LIGHTBOX_PLACEHOLDER_WRAPPER = "flex size-full items-center justify-center p-8";
const LIGHTBOX_PLACEHOLDER_SIZE = "h-full w-full max-h-[min(70vh,900px)] max-w-[min(90vw,900px)]";

const lightboxRender = {
  iconLoading: () => (
    <div className={LIGHTBOX_PLACEHOLDER_WRAPPER}>
      <GalleryMediaPlaceholder
        variant="lightbox"
        loading
        fill
        className={LIGHTBOX_PLACEHOLDER_SIZE}
      />
    </div>
  ),
  iconError: () => (
    <div className={LIGHTBOX_PLACEHOLDER_WRAPPER}>
      <GalleryMediaPlaceholder variant="lightbox" fill className={LIGHTBOX_PLACEHOLDER_SIZE} />
    </div>
  ),
};

export type GalleryLightboxProps = {
  images: GalleryImage[];
  index: number;
  open: boolean;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  plugins?: Plugin[];
  /** Disable slide animations (reduced motion). */
  animation?: { fade?: number; swipe?: number };
};

/**
 * Lightbox adapter (DIP). Only this file imports yet-another-react-lightbox.
 */
export function GalleryLightbox({
  images,
  index,
  open,
  onIndexChange,
  onClose,
  plugins = DEFAULT_PLUGINS,
  animation,
}: GalleryLightboxProps) {
  const slides = useMemo(
    () =>
      images.map((img) => {
        const src = resolveMediaSrc(img.src) ?? img.src;
        const slide: { src: string; alt?: string; title?: string } = { src };
        if (img.alt) {
          slide.alt = img.alt;
          slide.title = img.alt;
        }
        return slide;
      }),
    [images],
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      plugins={plugins}
      render={lightboxRender}
      animation={animation ?? { fade: 250, swipe: 300 }}
      on={{ view: ({ index: i }) => onIndexChange(i) }}
      carousel={{ finite: images.length <= 1 }}
      zoom={{ maxZoomPixelRatio: 3 }}
      styles={{
        container: { backgroundColor: "rgb(0 0 0 / 0.92)" },
      }}
      controller={{ closeOnBackdropClick: true }}
    />
  );
}
