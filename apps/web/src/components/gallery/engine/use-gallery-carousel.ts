"use client";

import type { CarouselApi } from "@auction/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

export type GalleryCarouselEvent = "select" | "reInit" | "settle";

export type GalleryCarouselApi = {
  index: number;
  count: number;
  scrollTo: (i: number) => void;
  scrollPrev: () => void;
  scrollNext: () => void;
  on: (event: GalleryCarouselEvent, cb: () => void) => () => void;
};

/**
 * Adapts Embla (via @auction/ui CarouselApi) to a stable gallery contract (DIP).
 * Only this module and packages/ui/carousel import Embla directly.
 */
export function useGalleryCarouselApi(api: CarouselApi | undefined): GalleryCarouselApi {
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);

  const sync = useCallback(() => {
    if (!api) return;
    setIndex(api.selectedScrollSnap());
    setCount(api.scrollSnapList().length);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    sync();
    api.on("reInit", sync);
    api.on("select", sync);
    return () => {
      api.off("reInit", sync);
      api.off("select", sync);
    };
  }, [api, sync]);

  const scrollTo = useCallback((i: number) => api?.scrollTo(i), [api]);
  const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = useCallback(() => api?.scrollNext(), [api]);

  const on = useCallback(
    (event: GalleryCarouselEvent, cb: () => void) => {
      if (!api) return () => undefined;
      api.on(event, cb);
      return () => api.off(event, cb);
    },
    [api],
  );

  return useMemo(
    () => ({
      index,
      count,
      scrollTo,
      scrollPrev,
      scrollNext,
      on,
    }),
    [index, count, scrollTo, scrollPrev, scrollNext, on],
  );
}
