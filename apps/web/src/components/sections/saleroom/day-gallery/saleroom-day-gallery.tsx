"use client";

import { MediaLightbox } from "@/components/gallery/engine/media-lightbox";
import { MarketingCatalogGrid } from "@/components/marketing/marketing-catalog-grid";
import {
  DAY_GALLERY_INLINE_PREVIEW,
  dayGalleryGridAriaLabel,
  dayGalleryHasVideos,
  formatDayGallerySubtitle,
  splitDayGalleryPreview,
} from "@/components/sections/saleroom/day-gallery/day-gallery-config";
import { DayGalleryOverflowTile } from "@/components/sections/saleroom/day-gallery/day-gallery-overflow-tile";
import { DayGallerySectionHeader } from "@/components/sections/saleroom/day-gallery/day-gallery-section-header";
import { DayGalleryViewAllSheet } from "@/components/sections/saleroom/day-gallery/day-gallery-view-all-sheet";
import { DayMediaThumbnail } from "@/components/sections/saleroom/day-gallery/day-media-thumbnail";
import type { DayGalleryVM } from "@/components/sections/saleroom/view-models";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { SaleDayMedia } from "@auction/types";
import { cn } from "@auction/ui";
import { useState } from "react";

type Props = {
  vm: DayGalleryVM;
  className?: string;
};

function previewBackgroundSrc(items: SaleDayMedia[]): string | null {
  const last = items.at(DAY_GALLERY_INLINE_PREVIEW - 1);
  if (!last) return null;
  if (last.mediaType === "video") return last.posterSrc ?? null;
  return last.src;
}

export function SaleroomDayGallery({ vm, className }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const { previewItems, overflowCount, total, showViewAll } = splitDayGalleryPreview(vm.items);
  const hasVideos = dayGalleryHasVideos(vm.items);
  const inlineCellCount = showViewAll ? previewItems.length + 1 : previewItems.length;
  const animation = reduceMotion ? { fade: 0, swipe: 0 } : { fade: 250, swipe: 300 };

  const openLightboxAt = (index: number) => {
    setSheetOpen(false);
    setLightboxIndex(index);
  };

  return (
    <>
      <div className={cn("space-y-6", className)} aria-labelledby="auction-day-gallery-heading">
        <DayGallerySectionHeader
          subtitle={formatDayGallerySubtitle(total, hasVideos)}
          total={total}
          showViewAll={showViewAll}
          onViewAll={() => setSheetOpen(true)}
        />

        <MarketingCatalogGrid
          count={inlineCellCount}
          multi="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
          ariaLabel={dayGalleryGridAriaLabel(hasVideos)}
        >
          {previewItems.map((item, index) => (
            <DayMediaThumbnail
              key={`${item.src}-${index}`}
              item={item}
              index={index}
              total={total}
              saleTitle={vm.saleTitle}
              variant="inline"
              onClick={() => setLightboxIndex(index)}
            />
          ))}
          {overflowCount > 0 ? (
            <DayGalleryOverflowTile
              overflowCount={overflowCount}
              total={total}
              hasVideos={hasVideos}
              backgroundSrc={previewBackgroundSrc(vm.items)}
              onClick={() => setSheetOpen(true)}
            />
          ) : null}
        </MarketingCatalogGrid>
      </div>

      <DayGalleryViewAllSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        items={vm.items}
        saleTitle={vm.saleTitle}
        onSelectIndex={openLightboxAt}
      />

      <MediaLightbox
        items={vm.items}
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(-1)}
        onIndexChange={setLightboxIndex}
        animation={animation}
      />
    </>
  );
}
