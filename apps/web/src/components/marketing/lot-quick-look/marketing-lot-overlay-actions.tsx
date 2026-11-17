"use client";

import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import type { ReactNode } from "react";
import { LotQuickLookTrigger } from "./lot-quick-look-trigger";
import type { LotQuickLookOpenOptions, LotQuickLookVM } from "./types";

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
  /** Optional badge/control rendered above the watchlist heart (e.g. owner badge). */
  topRightAddon?: ReactNode;
};

/**
 * Heart top-right and quick look bottom-left on a compact rail thumbnail (the lot page's "More
 * from" rail). Lot grid cards keep their picture clean instead: see `LotCardLotLine` and
 * `LotCardQuickLook`.
 */
export function MarketingLotOverlayActions({
  lotId,
  lotTitle,
  initialWatching,
  isAuthenticated,
  loginNextPath,
  vm,
  quickLookOptions,
  topRightAddon,
}: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute right-2 top-2 flex flex-col items-end gap-2">
        {topRightAddon}
        <MarketingWatchlistHeart
          lotId={lotId}
          lotTitle={lotTitle}
          initialWatching={initialWatching}
          isAuthenticated={isAuthenticated}
          loginNextPath={loginNextPath}
          layout="inline"
          surface="onImage"
          className="pointer-events-auto"
        />
      </div>
      <div className="absolute bottom-2 left-2 flex flex-col items-start gap-2">
        <LotQuickLookTrigger
          vm={vm}
          layout="overlay"
          surface="onImage"
          options={quickLookOptions}
          className="pointer-events-auto"
        />
      </div>
    </div>
  );
}
