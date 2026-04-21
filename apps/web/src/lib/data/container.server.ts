import "server-only";

import {
  getServerMyBids,
  getServerMyPortfolio,
  getServerMyWatchlist,
} from "@/lib/data/http/dashboard.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import type {
  DashboardActiveLotsReader,
  DashboardBidsReader,
  DashboardPortfolioReader,
  DashboardWatchlistReader,
} from "@/lib/data/readers/dashboard-readers";

export type ServerDataContainer = {
  bids: DashboardBidsReader;
  portfolio: DashboardPortfolioReader;
  watchlist: DashboardWatchlistReader;
  activeLots: DashboardActiveLotsReader;
};

/**
 * Composition root (DIP): server pages depend on this container, not on `fetch` / `hc` directly.
 */
export async function getServerDataContainer(): Promise<ServerDataContainer> {
  const lotReader = await getServerLotReader();
  return {
    bids: { listMine: getServerMyBids },
    portfolio: { listMine: getServerMyPortfolio },
    watchlist: { listMine: getServerMyWatchlist },
    activeLots: {
      listActivePreview: (limit) => lotReader.list({ status: "active", limit, sort: "endingAsc" }),
    },
  };
}
