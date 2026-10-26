import type { AtgSaleSettings, BuyerPremiumTier, SaleStatus } from "@auction/types";

/** Business settings for the mapping; transport settings live with the adapter. */
export type AtgSyncConfig = {
  platformCode: string;
  clientId: string | null;
  incrementSetId: string;
  defaultCategory: string;
  artistPlacement: "title_prefix" | "description";
  currency: string;
  countryCode: string;
  /** IANA zone of sale times; mapped to a Windows ID for GAP. */
  timezone: string;
  /** Public media origin used to turn stored image keys into URLs ATG can fetch. */
  mediaBaseUrl: string;
  maxImagesPerLot: number;
};

export type AtgLotSnapshot = {
  id: string;
  lotNumber: number | null;
  title: string;
  description: string | null;
  medium: string | null;
  dimensions: string | null;
  artistName: string | null;
  images: string[];
  startingPrice: string;
  reservePrice: string | null;
  buyNowPrice: string | null;
  buyerPremiumRate: string;
  endTime: Date;
  marketingDetails: Record<string, unknown>;
  updatedAt: Date;
};

export type AtgSaleSnapshot = {
  id: string;
  title: string;
  description: string | null;
  terms: string | null;
  startTime: Date;
  endTime: Date;
  saleStatus: SaleStatus;
  buyerPremiumRate: string;
  buyerPremiumTiers: BuyerPremiumTier[] | null;
  locationAddressLine1: string | null;
  locationAddressLine2: string | null;
  locationCity: string | null;
  locationPostcode: string | null;
  locationCountry: string | null;
  /** Cancelled in LAX: no further pushes; the auction can only be closed on ATG. */
  cancelled: boolean;
  updatedAt: Date;
  /** Staff-chosen ATG settings, or the defaults when the sale has no link row yet. */
  atgSettings: AtgSaleSettings;
  /** Non-deleted, non-cancelled lots currently in the sale, ordered by lot number. */
  lots: AtgLotSnapshot[];
};

export type AtgRemoteStatus = "pending" | "created" | "approved" | "published" | "closed";

export type AtgSaleOwnershipSnapshot = {
  saleStatus: SaleStatus;
  atgRemoteStatus: AtgRemoteStatus | null;
  atgLinked: boolean;
  atgSoldLotCount: number;
};

export type AtgAuctionLink = {
  saleId: string;
  atgAuctionId: string | null;
  remoteStatus: AtgRemoteStatus;
  payloadHash: string | null;
  lastSyncedAt: Date | null;
  approvedAt: Date | null;
  closedAt: Date | null;
  lastError: string | null;
};

export type AtgLotLink = {
  lotId: string;
  saleId: string;
  atgLotId: string;
  imageNames: string[];
  payloadHash: string | null;
  lockedFieldsHash: string | null;
  /** Bids ATG reported at the last poll; 0 before the first poll. */
  numberOfBids: number;
};

export type AtgPushSummary = {
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  failed: number;
};
