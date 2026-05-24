"use client";

import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { LotQuickLookTrigger } from "./lot-quick-look-trigger";
import type { LotQuickLookOpenOptions, LotQuickLookVM } from "./types";

type Inset = "compact" | "default";

type Props = {
  lotId: string;
  lotTitle: string;
  initialWatching: boolean;
  isAuthenticated: boolean;
  loginNextPath: string;
  vm: LotQuickLookVM;
  quickLookOptions: Omit<LotQuickLookOpenOptions, "deck" | "deckIndex"> & {
    deck?: LotQuickLookVM[];
    deckIndex?: number;
  };
  /** Matches lot detail rail (`compact`) vs home marketing tiles (`default`). */
  inset?: Inset;
  /** Optional badge/control rendered above the watchlist heart (e.g. owner badge). */
  topRightAddon?: ReactNode;
  /** Optional content under quick-look (e.g. live status pill on catalog cards). */
  bottomLeftAddon?: ReactNode;
  className?: string;
};

const topRightInset: Record<Inset, string> = {
  compact: "right-2 top-2",
  default: "right-3 top-3",
};

const bottomLeftInset: Record<Inset, string> = {
  compact: "bottom-2 left-2",
  default: "bottom-3 left-3",
};

/** Heart top-right, quick-look bottom-left — same layout as lot detail “More from” rails. */
export function MarketingLotOverlayActions({
  lotId,
  lotTitle,
  initialWatching,
  isAuthenticated,
  loginNextPath,
  vm,
  quickLookOptions,
  inset = "default",
  topRightAddon,
  bottomLeftAddon,
  className,
}: Props) {
  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute z-10 flex flex-col items-end gap-2",
          topRightInset[inset],
          className,
        )}
      >
        {topRightAddon}
        <MarketingWatchlistHeart
          lotId={lotId}
          lotTitle={lotTitle}
          initialWatching={initialWatching}
          isAuthenticated={isAuthenticated}
          loginNextPath={loginNextPath}
          layout="inline"
          className="pointer-events-auto"
        />
      </div>
      <div
        className={cn(
          "pointer-events-none absolute z-10 flex flex-col items-start gap-2",
          bottomLeftInset[inset],
          className,
        )}
      >
        <LotQuickLookTrigger
          vm={vm}
          layout="overlay"
          options={quickLookOptions}
          className="pointer-events-auto"
        />
        {bottomLeftAddon}
      </div>
    </>
  );
}
