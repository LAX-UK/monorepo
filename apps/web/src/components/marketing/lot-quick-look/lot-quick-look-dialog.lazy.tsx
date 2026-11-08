"use client";

import dynamic from "next/dynamic";

/**
 * Starts fetching the quick-look dialog. The dialog (with its lightbox and enrichment) is a large
 * piece of code that most visits never open, so it is not part of the page's first load: it is
 * fetched when a visitor shows intent (hover, focus or touch on a quick-look button) and again, if
 * that has not happened, when one is opened. Safe to call as often as needed.
 */
export function preloadLotQuickLookDialog() {
  return import("./lot-quick-look-dialog");
}

export const LazyLotQuickLookDialog = dynamic(
  () => preloadLotQuickLookDialog().then((module) => module.LotQuickLookDialog),
  { ssr: false },
);
