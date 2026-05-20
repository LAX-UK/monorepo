"use client";

import { useGalleryContext } from "@/components/gallery/context/gallery-context";
import { GalleryLightbox } from "@/components/gallery/engine/gallery-lightbox";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export function GalleryLightboxSlot() {
  const { images, index, setIndex, lightboxOpen, setLightboxOpen } = useGalleryContext();
  const reduceMotion = useReducedMotion();

  if (images.length === 0) return null;

  const animation = reduceMotion ? { fade: 0, swipe: 0 } : { fade: 250, swipe: 300 };

  return (
    <GalleryLightbox
      images={images}
      index={index}
      open={lightboxOpen}
      onIndexChange={setIndex}
      onClose={() => setLightboxOpen(false)}
      animation={animation}
    />
  );
}
