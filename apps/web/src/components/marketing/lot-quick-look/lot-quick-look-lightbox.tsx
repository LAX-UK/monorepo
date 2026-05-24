"use client";

import { GalleryLightbox } from "@/components/gallery/engine/gallery-lightbox";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { toGalleryImages } from "@auction/types";

type Props = {
  title: string;
  images: string[];
  index: number;
  open: boolean;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

/** Full-screen image viewer for quick-look hero tap. */
export function LotQuickLookLightbox({
  title,
  images,
  index,
  open,
  onIndexChange,
  onClose,
}: Props) {
  const reduceMotion = useReducedMotion();
  const galleryImages = toGalleryImages(images, undefined, title);
  const animation = reduceMotion ? { fade: 0, swipe: 0 } : { fade: 250, swipe: 300 };

  if (galleryImages.length === 0) return null;

  return (
    <GalleryLightbox
      images={galleryImages}
      index={index}
      open={open}
      onIndexChange={onIndexChange}
      onClose={onClose}
      animation={animation}
    />
  );
}
