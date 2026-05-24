"use client";

import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import type { Lot } from "@auction/types";
import { LotQuickLookTrigger } from "./lot-quick-look-trigger";
import { lotQuickLookFromLot } from "./mappers";

type Props = {
  lot: Lot;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath: string;
};

/** Watchlist + quick-look controls for search/catalog grid cards. */
export function CatalogLotQuickLookCorner({
  lot,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
}: Props) {
  const vm = lotQuickLookFromLot(lot);
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      <MarketingWatchlistHeart
        lotId={lot.id}
        lotTitle={lot.title}
        initialWatching={watchedLotIds.includes(lot.id)}
        isAuthenticated={isAuthenticated}
        loginNextPath={loginNextPath}
        layout="overlay"
      />
      <LotQuickLookTrigger
        vm={vm}
        layout="overlay"
        options={{
          isAuthenticated,
          watchedLotIds,
          loginNextPath,
        }}
      />
    </div>
  );
}
