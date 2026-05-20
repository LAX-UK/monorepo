"use client";

import { useGalleryContext } from "@/components/gallery/context/gallery-context";
import { CounterPill } from "@/components/gallery/parts/counter-pill";
import { ThumbPile3PlusN } from "@/components/gallery/parts/thumb-pile-3-plus-n";

const COUNTER_LIVE_ID = "gallery-counter-live";

/** Mobile thumb pile + counter overlaid on the hero. */
export function GalleryHeroOverlays() {
  const { images, index, setIndex, openViewAll } = useGalleryContext();
  const total = images.length;

  return (
    <>
      <CounterPill
        total={total}
        index={index}
        onSelect={setIndex}
        liveId={COUNTER_LIVE_ID}
        className="md:top-4"
      />
      <ThumbPile3PlusN
        images={images}
        total={total}
        index={index}
        onSelect={setIndex}
        onOverflow={openViewAll}
        className="absolute bottom-6 left-6 md:hidden"
      />
    </>
  );
}
