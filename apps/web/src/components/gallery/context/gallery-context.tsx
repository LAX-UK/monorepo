"use client";

import type { GalleryCarouselApi } from "@/components/gallery/engine/use-gallery-carousel";
import { useGalleryFocusReturn } from "@/components/gallery/hooks/use-gallery-focus-return";
import type { GalleryImage } from "@auction/types";
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

export type GalleryContextValue = {
  title: string;
  images: GalleryImage[];
  index: number;
  setIndex: (i: number) => void;
  carousel: GalleryCarouselApi;
  lightboxOpen: boolean;
  setLightboxOpen: (open: boolean) => void;
  viewAllOpen: boolean;
  setViewAllOpen: (open: boolean) => void;
  openLightbox: () => void;
  openViewAll: () => void;
  priorityIndices: Set<number>;
};

const GalleryContext = createContext<GalleryContextValue | null>(null);

export function useGalleryContext(): GalleryContextValue {
  const ctx = useContext(GalleryContext);
  if (!ctx) {
    throw new Error("useGalleryContext must be used within <LotGallery>");
  }
  return ctx;
}

type ProviderProps = {
  title: string;
  images: GalleryImage[];
  carousel: GalleryCarouselApi;
  priorityIndices: Set<number>;
  children: ReactNode;
};

export function GalleryProvider({
  title,
  images,
  carousel,
  priorityIndices,
  children,
}: ProviderProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const { capture } = useGalleryFocusReturn(lightboxOpen);

  const setIndex = useCallback(
    (i: number) => {
      carousel.scrollTo(i);
    },
    [carousel],
  );

  const openLightbox = useCallback(() => {
    capture();
    setLightboxOpen(true);
  }, [capture]);
  const openViewAll = useCallback(() => setViewAllOpen(true), []);

  const value = useMemo<GalleryContextValue>(
    () => ({
      title,
      images,
      index: carousel.index,
      setIndex,
      carousel,
      lightboxOpen,
      setLightboxOpen,
      viewAllOpen,
      setViewAllOpen,
      openLightbox,
      openViewAll,
      priorityIndices,
    }),
    [
      title,
      images,
      carousel,
      setIndex,
      lightboxOpen,
      viewAllOpen,
      openLightbox,
      openViewAll,
      priorityIndices,
    ],
  );

  return <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>;
}
