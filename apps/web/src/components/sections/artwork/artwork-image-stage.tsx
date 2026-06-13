"use client";

import { LotGalleryLazy } from "@/components/gallery/lot-gallery-lazy";

import type { GalleryImage } from "@auction/types";

type Props = {
  title: string;
  images: string[];
  imageAssets?: GalleryImage[];
  /** Optional per-index alt text (parallel to `images`) */
  imageAlts?: (string | undefined)[] | undefined;
};

/** Lot detail image gallery (composition root delegates to {@link LotGallery}). */
export function ArtworkImageStage({ title, images, imageAssets, imageAlts }: Props) {
  return (
    <LotGalleryLazy
      title={title}
      images={images}
      {...(imageAssets ? { imageAssets } : {})}
      {...(imageAlts ? { imageAlts } : {})}
    />
  );
}
