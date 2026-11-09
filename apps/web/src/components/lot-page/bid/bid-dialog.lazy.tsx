"use client";

import type { LotBidDialogProps } from "@/components/lot-page/bid/bid-dialog";
import dynamic from "next/dynamic";

/**
 * Starts fetching the bid dialog. It is not part of the lot page's first load: nobody sees it
 * until they press a bid button, so it is fetched once the page is idle, and again, if that has
 * not happened, when it is first opened. Safe to call as often as needed.
 */
export function preloadBidDialog() {
  return import("@/components/lot-page/bid/bid-dialog");
}

export const LazyLotBidDialog = dynamic<LotBidDialogProps>(
  () => preloadBidDialog().then((module) => module.LotBidDialog),
  { ssr: false },
);
