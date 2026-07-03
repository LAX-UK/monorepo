import type { SaleroomDisplayOverlay } from "@auction/types";
import type { CatalogLotRow } from "../lib/display-snapshot-reader.helpers.js";

export type SaleroomDisplaySaleRow = {
  id: string;
  title: string;
  deliveryMode: string;
  coverImages: string[] | null;
};

export type SaleroomDisplaySessionRow = {
  status: string;
  currentLotId: string | null;
  displayOverlay: SaleroomDisplayOverlay | null;
  startedAt: Date | null;
};

export type SaleroomDisplayCurrentLotRow = {
  id: string;
  lotNumber: number | null;
  title: string;
  images: string[] | null;
  currentPrice: string;
  marketingDetails: Record<string, unknown> | null;
  minBidIncrement: string | null;
};

export type SaleroomDisplayRecentBidRow = {
  id: string;
  amount: string;
  placedVia: string | null;
  isAutoBid: boolean;
  createdAt: Date;
};

export interface ISaleroomDisplaySnapshotReader {
  findSale(saleId: string): Promise<SaleroomDisplaySaleRow | null>;
  findSession(saleId: string): Promise<SaleroomDisplaySessionRow | null>;
  findCurrentLot(lotId: string): Promise<SaleroomDisplayCurrentLotRow | null>;
  countBidsForLot(lotId: string): Promise<number>;
  findWinningBidderId(lotId: string): Promise<string | null>;
  findCheckedInPaddleNumber(saleId: string, userId: string): Promise<number | null>;
  listRecentBids(lotId: string, limit: number): Promise<SaleroomDisplayRecentBidRow[]>;
  listCatalogLots(saleId: string): Promise<CatalogLotRow[]>;
}
