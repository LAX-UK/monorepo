"use client";

import type { DayGalleryViewAllSheetProps } from "@/components/sections/saleroom/day-gallery/day-gallery-view-all-sheet";
import dynamic from "next/dynamic";

/**
 * Starts fetching the "view all" sheet and its drawer library. They are not part of the page's
 * first load: the sheet shows only when "View all" is pressed, so it is fetched when that control
 * is pointed at or focused, and again, if that has not happened, when the sheet is first opened.
 * Safe to call as often as needed.
 */
export function preloadDayGalleryViewAllSheet() {
  return import("@/components/sections/saleroom/day-gallery/day-gallery-view-all-sheet");
}

export const LazyDayGalleryViewAllSheet = dynamic<DayGalleryViewAllSheetProps>(
  () => preloadDayGalleryViewAllSheet().then((module) => module.DayGalleryViewAllSheet),
  { ssr: false },
);
