import type { LotCardExtras } from "@/components/lot-card/lot-card-extras";
import { LotCardQuickLook } from "@/components/lot-card/lot-card-quick-look";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import type { CatalogLotVM } from "@auction/types";
import { lotQuickLookFromLot } from "./mappers";

type Viewer = {
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath: string;
};

/** The save heart and quick look label of a search (catalogue grid) lot card. */
export function catalogLotCardExtras(lot: CatalogLotVM, viewer: Viewer): LotCardExtras {
  return {
    save: (
      <MarketingWatchlistHeart
        lotId={lot.id}
        lotTitle={lot.title}
        initialWatching={viewer.watchedLotIds.includes(lot.id)}
        isAuthenticated={viewer.isAuthenticated}
        loginNextPath={viewer.loginNextPath}
        layout="line"
      />
    ),
    quickLook: <LotCardQuickLook vm={lotQuickLookFromLot(lot)} options={viewer} />,
  };
}
