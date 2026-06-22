"use client";

import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import type { SaleDayMedia } from "@auction/types";
import { useEffect, useMemo } from "react";
import Lightbox, { type Plugin } from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

const DEFAULT_PLUGINS = [Video, Zoom, Thumbnails, Counter, Fullscreen, Captions];

/** Infer a video MIME type from the URL extension. Defaults to "video/mp4". */
function videoMimeFromSrc(src: string): "video/mp4" | "video/webm" {
  const base = src.split("?")[0] ?? "";
  return base.endsWith(".webm") ? "video/webm" : "video/mp4";
}

function buildMediaSlides(items: SaleDayMedia[]) {
  return items.map((item) => {
    if (item.mediaType === "video") {
      const src = resolveMediaSrc(item.src) ?? item.src;
      const posterSrc = item.posterSrc
        ? (resolveMediaSrc(item.posterSrc) ?? item.posterSrc)
        : undefined;
      return {
        type: "video" as const,
        sources: [{ src, type: videoMimeFromSrc(src) }],
        ...(posterSrc ? { poster: posterSrc } : {}),
        ...(item.width ? { width: item.width } : {}),
        ...(item.height ? { height: item.height } : {}),
        ...(item.caption ? { description: item.caption } : {}),
        controls: true,
        playsInline: true,
      };
    }

    const src = resolveMediaSrc(item.src) ?? item.src;
    return {
      src,
      alt: item.alt ?? "",
      ...(item.width ? { width: item.width } : {}),
      ...(item.height ? { height: item.height } : {}),
      ...(item.blurDataURL ? { blurDataURL: item.blurDataURL } : {}),
      ...(item.caption ? { description: item.caption } : {}),
    };
  });
}

export type MediaLightboxProps = {
  items: SaleDayMedia[];
  index: number;
  open: boolean;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  plugins?: Plugin[];
  /** Disable slide animations (reduced motion). */
  animation?: { fade?: number; swipe?: number };
};

/**
 * Mixed image/video lightbox adapter (DIP). Only engine modules import yet-another-react-lightbox.
 */
export function MediaLightbox({
  items,
  index,
  open,
  onIndexChange,
  onClose,
  plugins = DEFAULT_PLUGINS,
  animation,
}: MediaLightboxProps) {
  const slides = useMemo(() => buildMediaSlides(items), [items]);

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
      video={{ controls: true, playsInline: true }}
      animation={animation ?? { fade: 250, swipe: 300 }}
      on={{ view: ({ index: i }) => onIndexChange(i) }}
      carousel={{ finite: items.length <= 1 }}
      styles={{
        container: { backgroundColor: "rgb(0 0 0 / 0.92)" },
      }}
      controller={{ closeOnBackdropClick: true }}
    />
  );
}
