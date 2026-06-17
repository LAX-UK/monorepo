"use client";

import { useGalleryContext } from "@/components/gallery/context/gallery-context";
import { CounterPill } from "@/components/gallery/parts/counter-pill";

const COUNTER_LIVE_ID = "gallery-counter-live";

/** Counter pill overlaid on the hero (position + aria-live). */
export function GalleryHeroOverlays() {
  const { images, index, setIndex } = useGalleryContext();
  const total = images.length;

  return (
    <CounterPill
      total={total}
      index={index}
      onSelect={setIndex}
      liveId={COUNTER_LIVE_ID}
      className="md:top-4"
    />
  );
}
