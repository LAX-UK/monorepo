"use client";

import { useGalleryContext } from "@/components/gallery/context/gallery-context";
import { GALLERY_MEDIA_PLACEHOLDER_LABEL } from "@/components/gallery/parts/gallery-media-placeholder";
import { MediaImage } from "@/components/ui/media-image";
import { Button, cn } from "@auction/ui";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@auction/ui/components/bottom-sheet";
import { useCallback, useRef } from "react";

const LONG_PRESS_MS = 500;

export function ViewAllSheet() {
  const { title, images, index, setIndex, viewAllOpen, setViewAllOpen, setLightboxOpen } =
    useGalleryContext();

  const close = useCallback(() => setViewAllOpen(false), [setViewAllOpen]);

  const selectImage = useCallback(
    (i: number) => {
      setIndex(i);
      close();
    },
    [setIndex, close],
  );

  const openLightboxAt = useCallback(
    (i: number) => {
      setIndex(i);
      close();
      setLightboxOpen(true);
    },
    [setIndex, close, setLightboxOpen],
  );

  if (images.length <= 1) return null;

  return (
    <BottomSheet open={viewAllOpen} onOpenChange={setViewAllOpen}>
      <BottomSheetContent className="max-h-[85dvh]">
        <BottomSheetHeader className="px-6 pt-2 text-left">
          <BottomSheetTitle className="font-label text-sm uppercase tracking-wide">
            All images
          </BottomSheetTitle>
          <BottomSheetDescription>
            {images.length} images for {title}
          </BottomSheetDescription>
        </BottomSheetHeader>
        <div className="grid grid-cols-3 gap-2 px-6 pb-6 md:grid-cols-4 lg:grid-cols-5">
          {images.map((img, i) => (
            <GridThumb
              key={`grid-${img.src}__${i}`}
              image={img}
              i={i}
              total={images.length}
              active={i === index}
              onSelect={() => selectImage(i)}
              onLongPress={() => openLightboxAt(i)}
            />
          ))}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function GridThumb({
  image,
  i,
  total,
  active,
  onSelect,
  onLongPress,
}: {
  image: { src: string };
  i: number;
  total: number;
  active: boolean;
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={`Show image ${i + 1} of ${total}`}
      aria-current={active ? "true" : undefined}
      onClick={onSelect}
      onPointerDown={() => {
        clearTimer();
        timerRef.current = setTimeout(onLongPress, LONG_PRESS_MS);
      }}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-md p-0",
        active && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <MediaImage src={image.src} alt="" label={GALLERY_MEDIA_PLACEHOLDER_LABEL} sizes="120px" />
    </Button>
  );
}
