"use client";

import dynamic from "next/dynamic";

/**
 * Starts fetching the day-gallery viewer (the lightbox with its zoom and thumbnail plugins). It is
 * not part of the page's first load: it is fetched when someone points at or focuses a picture,
 * and again, if that has not happened, when one is opened. Safe to call as often as needed.
 */
export function preloadMediaLightbox() {
  return import("@/components/gallery/engine/media-lightbox");
}

export const LazyMediaLightbox = dynamic(
  () => preloadMediaLightbox().then((module) => module.MediaLightbox),
  { ssr: false },
);
