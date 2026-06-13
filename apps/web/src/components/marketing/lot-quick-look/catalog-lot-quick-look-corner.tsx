"use client";

import type { CatalogLotVM } from "@auction/types";
import type { ReactNode } from "react";
import { lotQuickLookFromLot } from "./mappers";
import { MarketingLotOverlayActions } from "./marketing-lot-overlay-actions";

type Props = {
  lot: CatalogLotVM;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath: string;
  bottomLeftAddon?: ReactNode;
};

/** Watchlist + quick-look controls for search/catalog grid cards. */
export function CatalogLotQuickLookCorner({
  lot,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
  bottomLeftAddon,
}: Props) {
  const vm = lotQuickLookFromLot(lot);
  return (
    <MarketingLotOverlayActions
      lotId={lot.id}
      lotTitle={lot.title}
      initialWatching={watchedLotIds.includes(lot.id)}
      isAuthenticated={isAuthenticated}
      loginNextPath={loginNextPath}
      vm={vm}
      quickLookOptions={{
        isAuthenticated,
        watchedLotIds,
        loginNextPath,
      }}
      bottomLeftAddon={bottomLeftAddon}
    />
  );
}
