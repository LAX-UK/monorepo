import type { BidWithLot, WatchlistWithLotRow } from "@/lib/data/http/dashboard.server";
import type { Lot } from "@auction/types";
import type { PortfolioRow } from "@auction/types";

/** ISP: read-only bids for dashboard surfaces */
export type DashboardBidsReader = {
  listMine(): Promise<BidWithLot[]>;
};

export type DashboardPortfolioReader = {
  listMine(): Promise<PortfolioRow[]>;
};

export type DashboardWatchlistReader = {
  listMine(): Promise<WatchlistWithLotRow[]>;
};

export type DashboardActiveLotsReader = {
  listActivePreview(limit: number): Promise<Lot[]>;
};
