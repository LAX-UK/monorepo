"use client";

import type { LotBidDialogProps } from "@/components/lot-page/bid/bid-dialog";
import { runWhenIdle } from "@/lib/ui/run-when-idle";
import { Dialog } from "@auction/ui/lax";
import dynamic from "next/dynamic";
import { useEffect } from "react";

type BidDialogModule = typeof import("@/components/lot-page/bid/bid-dialog");

/** Runs `load`, and once more if it fails: a chunk that failed to arrive is usually a blip. */
export async function loadWithOneRetry<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch {
    return load();
  }
}

let pending: Promise<BidDialogModule> | null = null;

/**
 * Starts fetching the bid dialog and returns the one shared request. It is not part of the lot
 * page's first load: nobody sees it until they press a bid button, so it is fetched once the page
 * is idle, when a bid control is approached, and, if none of that has happened, when it is
 * opened. A failed fetch is retried once, and a request that still failed is not kept, so the
 * next attempt starts afresh. Safe to call as often as needed.
 */
export function preloadBidDialog(): Promise<BidDialogModule> {
  if (!pending) {
    pending = loadWithOneRetry(() => import("@/components/lot-page/bid/bid-dialog")).catch(
      (error: unknown) => {
        pending = null;
        throw error;
      },
    );
  }
  return pending;
}

/** Forgets the shared request. For tests only. */
export function resetBidDialogPreloadForTests(): void {
  pending = null;
}

/**
 * Fetches the bid dialog once the page is idle, so pressing a bid button opens it at once. Only
 * where bidding is possible: a lot that is closed or not yet open never loads it.
 */
export function usePreloadBidDialogWhenIdle(biddingPossible: boolean): void {
  useEffect(() => {
    if (!biddingPossible) return;
    return runWhenIdle(() => {
      preloadBidDialog().catch(() => {});
    });
  }, [biddingPossible]);
}

/** What shows for the moment between pressing a bid button and the dialog arriving. */
function BidDialogLoading() {
  return (
    <Dialog open onOpenChange={() => {}} title="Place a bid" description="Opening bidding…">
      <div role="status" aria-busy="true" className="min-h-40" />
    </Dialog>
  );
}

export const LazyLotBidDialog = dynamic<LotBidDialogProps>(
  () => preloadBidDialog().then((module) => module.LotBidDialog),
  { ssr: false, loading: BidDialogLoading },
);
