"use client";

import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { lotQuickLookFromSaleLotCard } from "./mappers";
import { MarketingLotOverlayActions } from "./marketing-lot-overlay-actions";

type Props = {
  lot: SaleLotCardVM;
  isAuthenticated: boolean;
};

/** Watchlist + quick-look overlays for saleroom lot tile corners. */
export function SaleroomLotQuickLookCorner({ lot, isAuthenticated }: Props) {
  const vm = lotQuickLookFromSaleLotCard(lot);
  return (
    <MarketingLotOverlayActions
      lotId={lot.id}
      lotTitle={lot.title}
      initialWatching={lot.viewerIsWatching}
      isAuthenticated={isAuthenticated}
      loginNextPath={lot.href}
      vm={vm}
      quickLookCorner="bottomRight"
      quickLookOptions={{
        isAuthenticated,
        watchedLotIds: lot.viewerIsWatching ? [lot.id] : [],
        loginNextPath: lot.href,
      }}
    />
  );
}
