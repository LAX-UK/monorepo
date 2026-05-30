"use client";

import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { LotQuickLookTrigger } from "./lot-quick-look-trigger";
import { lotQuickLookFromSaleLotCard } from "./mappers";

type Props = {
  lot: SaleLotCardVM;
  isAuthenticated: boolean;
};

/** Watchlist + quick-look beside list row title (not on the 96px thumb). */
export function SaleroomLotListActions({ lot, isAuthenticated }: Props) {
  const vm = lotQuickLookFromSaleLotCard(lot);
  return (
    <div className="flex shrink-0 items-center gap-2">
      <MarketingWatchlistHeart
        lotId={lot.id}
        lotTitle={lot.title}
        initialWatching={lot.viewerIsWatching}
        isAuthenticated={isAuthenticated}
        loginNextPath={lot.href}
        layout="inline"
      />
      <LotQuickLookTrigger
        vm={vm}
        layout="inline"
        options={{
          isAuthenticated,
          watchedLotIds: lot.viewerIsWatching ? [lot.id] : [],
          loginNextPath: lot.href,
        }}
      />
    </div>
  );
}
