"use client";

import type { LotBidDialogProps } from "@/components/lot-page/bid/bid-dialog";
import { runWhenIdle } from "@/lib/ui/run-when-idle";
import dynamic from "next/dynamic";
import { useEffect } from "react";

/**
 * Starts fetching the bid dialog. It is not part of the lot page's first load: nobody sees it
 * until they press a bid button, so it is fetched once the page is idle, and again, if that has
 * not happened, when it is first opened. Safe to call as often as needed.
 */
export function preloadBidDialog() {
  return import("@/components/lot-page/bid/bid-dialog");
}

/** Fetches the bid dialog once the page is idle, so pressing a bid button opens it at once. */
export function usePreloadBidDialogWhenIdle(): void {
  useEffect(() => runWhenIdle(() => void preloadBidDialog()), []);
}

export const LazyLotBidDialog = dynamic<LotBidDialogProps>(
  () => preloadBidDialog().then((module) => module.LotBidDialog),
  { ssr: false },
);
