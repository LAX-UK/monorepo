"use client";

import { GalleryProvider } from "@/components/gallery/context/gallery-context";
import { useGalleryCarouselApi } from "@/components/gallery/engine/use-gallery-carousel";
import { useNeighborPreload } from "@/components/gallery/hooks/use-neighbor-preload";
import { Filmstrip } from "@/components/gallery/parts/filmstrip";
import { GalleryHero } from "@/components/gallery/parts/gallery-hero";
import { GalleryLightboxSlot } from "@/components/gallery/parts/gallery-lightbox-slot";
import { GalleryHeroOverlays } from "@/components/gallery/parts/gallery-overlays";
import { ViewAllSheet } from "@/components/gallery/parts/view-all-sheet";
import { toGalleryImages } from "@auction/types";
import type { CarouselApi } from "@auction/ui";
import { useState } from "react";

type LotGalleryProps = {
  title: string;
  images: string[];
  imageAlts?: (string | undefined)[] | undefined;
};

function LotGalleryRoot({ title, images, imageAlts }: LotGalleryProps) {
  const galleryImages = toGalleryImages(images, imageAlts, title);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const carousel = useGalleryCarouselApi(carouselApi);
  const priorityIndices = useNeighborPreload(
    carousel.index,
    carousel.count || galleryImages.length,
  );

  return (
    <GalleryProvider
      title={title}
      images={galleryImages}
      carousel={carousel}
      priorityIndices={priorityIndices}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative min-h-0 flex-1">
          <GalleryHero setCarouselApi={setCarouselApi} className="absolute inset-0" />
          <GalleryHeroOverlays />
        </div>
        <Filmstrip />
      </div>
      <ViewAllSheet />
      <GalleryLightboxSlot />
    </GalleryProvider>
  );
}

export const LotGallery = Object.assign(LotGalleryRoot, {
  Hero: GalleryHero,
  CounterPill: GalleryHeroOverlays,
  ThumbPile: GalleryHeroOverlays,
  Filmstrip,
  Lightbox: GalleryLightboxSlot,
  ViewAll: ViewAllSheet,
});
