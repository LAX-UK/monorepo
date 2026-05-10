import type {
  ArtistFollowRow,
  BidWithLot,
  WatchlistListParams,
  WatchlistWithLotRow,
} from "@/lib/data/http/dashboard.server";
import type { MyPaymentRow, MyPaymentsListParams } from "@/lib/data/http/payments.server";
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
  listMine(params?: WatchlistListParams): Promise<WatchlistWithLotRow[]>;
};

export type DashboardArtistFollowReader = {
  listMine(): Promise<ArtistFollowRow[]>;
};

export type DashboardActiveLotsReader = {
  listActivePreview(limit: number): Promise<Lot[]>;
};

/** ISP: buyer-only payments view (no admin/seller endpoints leak in). */
export type DashboardPaymentsReader = {
  listMine(params?: MyPaymentsListParams): Promise<MyPaymentRow[]>;
};
