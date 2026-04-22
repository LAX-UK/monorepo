import "server-only";

export { getWriteContainer, type WriteServiceContainer } from "./write-container.server";

import {
  getServerMyArtistFollows,
  getServerMyBids,
  getServerMyPortfolio,
  getServerMyWatchlist,
} from "@/lib/data/http/dashboard.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSalesList } from "@/lib/data/http/sales.server";
import type {
  DashboardActiveLotsReader,
  DashboardArtistFollowReader,
  DashboardBidsReader,
  DashboardPortfolioReader,
  DashboardWatchlistReader,
} from "@/lib/data/readers/dashboard-readers";
import type { LiveSaleReader } from "@/lib/data/readers/marketing-readers";

export type ServerDataContainer = {
  bids: DashboardBidsReader;
  portfolio: DashboardPortfolioReader;
  watchlist: DashboardWatchlistReader;
  artistFollow: DashboardArtistFollowReader;
  activeLots: DashboardActiveLotsReader;
  liveSale: LiveSaleReader;
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
    artistFollow: { listMine: getServerMyArtistFollows },
    activeLots: {
      listActivePreview: (limit) => lotReader.list({ status: "active", limit, sort: "endingAsc" }),
    },
    liveSale: {
      peek: async () => {
        try {
          const rows = await getServerSalesList({ status: "active", limit: 1 });
          const row = rows[0];
          if (!row) return null;
          return { id: row.sale.id, title: row.sale.title };
        } catch {
          return null;
        }
      },
    },
  };
}
