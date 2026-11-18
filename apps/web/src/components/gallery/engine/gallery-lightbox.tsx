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

/**
 * The lightbox centres its loading and error content in an absolutely positioned box with no size
 * of its own, so a filling placeholder would collapse to nothing. This frame gives it the slide's
 * box (the same caps the image is shown within) for the placeholder to fill.
 */
const LIGHTBOX_PLACEHOLDER_FRAME = "relative h-[min(70vh,900px)] w-[min(90vw,900px)]";

const lightboxRender = {
  iconLoading: () => (
    <div className={LIGHTBOX_PLACEHOLDER_FRAME} data-testid="lightbox-placeholder-frame">
      <GalleryMediaPlaceholder variant="lightbox" loading fill />
    </div>
  ),
  iconError: () => (
    <div className={LIGHTBOX_PLACEHOLDER_FRAME} data-testid="lightbox-placeholder-frame">
      <GalleryMediaPlaceholder variant="lightbox" fill />
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
        // Full-resolution original for zoom — never route through `/_next/image`.
        const src = resolveMediaSrc(img.src) ?? img.src;
        const slide: {
          src: string;
          alt?: string;
          title?: string;
          placeholder?: string;
        } = { src };
        if (img.alt) {
          slide.alt = img.alt;
          slide.title = img.alt;
        }
        if (img.blurDataURL) {
          slide.placeholder = img.blurDataURL;
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
