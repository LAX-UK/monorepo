"use client";

import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { LotQuickLookTrigger } from "./lot-quick-look-trigger";
import { lotQuickLookFromSaleLotCard } from "./mappers";

type Props = {
  lot: SaleLotCardVM;
  isAuthenticated: boolean;
};

/** Watchlist + quick-look stack for saleroom lot tile corners. */
export function SaleroomLotQuickLookCorner({ lot, isAuthenticated }: Props) {
  const vm = lotQuickLookFromSaleLotCard(lot);
  return (
    <div className="flex flex-col items-end gap-2">
      <MarketingWatchlistHeart
        lotId={lot.id}
        lotTitle={lot.title}
        initialWatching={lot.viewerIsWatching}
        isAuthenticated={isAuthenticated}
        loginNextPath={lot.href}
      />
      <LotQuickLookTrigger
        vm={vm}
        layout="overlay"
        options={{
          isAuthenticated,
          watchedLotIds: lot.viewerIsWatching ? [lot.id] : [],
          loginNextPath: lot.href,
        }}
      />
    </div>
  );
}
