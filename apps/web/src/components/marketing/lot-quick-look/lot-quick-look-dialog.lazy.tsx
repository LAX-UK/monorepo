"use client";

import { Loader2 } from "lucide-react";
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

/** Shown for the moment a first open waits on the fetch, so the press is seen to have worked. */
function QuickLookLoading() {
  return (
    <output
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[var(--z-modal,80)] flex items-center justify-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-container-high text-on-surface shadow-lg">
        <Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
        <span className="sr-only">Loading quick look</span>
      </span>
    </output>
  );
}

export const LazyLotQuickLookDialog = dynamic(
  () => preloadLotQuickLookDialog().then((module) => module.LotQuickLookDialog),
  { ssr: false, loading: QuickLookLoading },
);
