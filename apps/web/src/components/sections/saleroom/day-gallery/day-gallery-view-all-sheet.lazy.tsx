"use client";

import type { DayGalleryViewAllSheetProps } from "@/components/sections/saleroom/day-gallery/day-gallery-view-all-sheet";
import { useDeferredModule } from "@/hooks/use-deferred-module";
import { useEffect, useRef } from "react";

/**
 * Starts fetching the "view all" sheet and its drawer library. They are not part of the page's
 * first load: the sheet shows only when "View all" is pressed, so it is fetched when that control
 * is pointed at or focused, and again, if that has not happened, when the sheet is first opened.
 * Safe to call as often as needed.
 */
export function preloadDayGalleryViewAllSheet() {
  return import("@/components/sections/saleroom/day-gallery/day-gallery-view-all-sheet");
}

const loadSheet = () =>
  preloadDayGalleryViewAllSheet().then((module) => module.DayGalleryViewAllSheet);

/**
 * The sheet, mounted on the first press of "View all" and drawn (already open) once it arrives.
 * If it cannot be fetched, the press is undone (`onOpenChange(false)`) instead of the failure
 * reaching the page's error screen, and the next press fetches it again.
 */
export function LazyDayGalleryViewAllSheet(props: DayGalleryViewAllSheetProps) {
  const loaded = useDeferredModule(loadSheet, true);
  const { open, onOpenChange } = props;
  // The current failure has been answered by closing; a later press is a request to try again.
  const failureHandled = useRef(false);
  const failed = loaded.status === "failed";
  const { retry } = loaded;

  useEffect(() => {
    if (!failed) return;
    if (!failureHandled.current) {
      failureHandled.current = true;
      if (open) onOpenChange(false);
      return;
    }
    if (open) {
      failureHandled.current = false;
      retry();
    }
  }, [failed, open, onOpenChange, retry]);

  if (loaded.status !== "ready") return null;
  return <loaded.value {...props} />;
}
