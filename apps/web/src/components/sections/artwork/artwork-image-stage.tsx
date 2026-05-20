"use client";

import { LotGallery } from "@/components/gallery/lot-gallery";

type Props = {
  title: string;
  images: string[];
  /** Optional per-index alt text (parallel to `images`) */
  imageAlts?: (string | undefined)[] | undefined;
};

/** Lot detail image gallery (composition root delegates to {@link LotGallery}). */
export function ArtworkImageStage({ title, images, imageAlts }: Props) {
  return <LotGallery title={title} images={images} imageAlts={imageAlts} />;
}
