"use client";

import { DayMediaThumbnail } from "@/components/sections/saleroom/day-gallery/day-media-thumbnail";
import type { SaleDayMedia } from "@auction/types";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@auction/ui/components/bottom-sheet";

export type DayGalleryViewAllSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SaleDayMedia[];
  saleTitle: string;
  onSelectIndex: (index: number) => void;
};

export function DayGalleryViewAllSheet({
  open,
  onOpenChange,
  items,
  saleTitle,
  onSelectIndex,
}: DayGalleryViewAllSheetProps) {
  const total = items.length;
  const hasVideos = items.some((item) => item.mediaType === "video");
  const mediaNoun = hasVideos ? "photos and videos" : "photographs";

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="max-h-[85dvh]">
        <BottomSheetHeader className="px-6 pt-2 text-left">
          <BottomSheetTitle className="font-label text-sm uppercase tracking-wide">
            All auction day media
          </BottomSheetTitle>
          <BottomSheetDescription>
            {total} {mediaNoun} for {saleTitle}
          </BottomSheetDescription>
        </BottomSheetHeader>
        <div className="grid grid-cols-3 gap-2 px-6 pb-6 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item, index) => (
            <DayMediaThumbnail
              key={`${item.src}-${index}`}
              item={item}
              index={index}
              total={total}
              saleTitle={saleTitle}
              variant="sheet"
              onClick={() => onSelectIndex(index)}
            />
          ))}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
