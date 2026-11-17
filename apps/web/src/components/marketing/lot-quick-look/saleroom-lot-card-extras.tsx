import type { LotCardExtras } from "@/components/lot-card/lot-card-extras";
import { LotCardQuickLook } from "@/components/lot-card/lot-card-quick-look";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { lotQuickLookFromSaleLotCard } from "./mappers";

/** The save heart and quick look label of a sale page lot card. */
export function saleroomLotCardExtras(lot: SaleLotCardVM, isAuthenticated: boolean): LotCardExtras {
  return {
    save: (
      <MarketingWatchlistHeart
        lotId={lot.id}
        lotTitle={lot.title}
        initialWatching={lot.viewerIsWatching}
        isAuthenticated={isAuthenticated}
        loginNextPath={lot.href}
        layout="inline"
        surface="inline"
      />
    ),
    quickLook: (
      <LotCardQuickLook
        vm={lotQuickLookFromSaleLotCard(lot)}
        options={{
          isAuthenticated,
          watchedLotIds: lot.viewerIsWatching ? [lot.id] : [],
          loginNextPath: lot.href,
        }}
      />
    ),
  };
}
