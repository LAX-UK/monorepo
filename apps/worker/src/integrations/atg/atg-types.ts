import type { GapAuctionTypeAndListing } from "./gap-types.js";

/** Business settings for the mapping; transport settings live with the adapter. */
export type AtgSyncConfig = {
  platformCode: string;
  clientId: string | null;
  incrementSetId: string;
  defaultCategory: string;
  auctionType: GapAuctionTypeAndListing;
  /** Sent as `AuctionListings[].Private`; true keeps auctions off public listings. */
  listingPrivate: boolean;
  artistPlacement: "title_prefix" | "description";
  /** Call `ApproveAuction` before `PublishAuction` (depends on ATG's approval model). */
  approveBeforePublish: boolean;
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
  buyerPremiumRate: string;
  locationAddressLine1: string | null;
  locationAddressLine2: string | null;
  locationCity: string | null;
  locationPostcode: string | null;
  locationCountry: string | null;
  /** Cancelled in LAX: no further pushes; the auction can only be closed on ATG. */
  cancelled: boolean;
  updatedAt: Date;
  /** Non-deleted, non-cancelled lots currently in the sale, ordered by lot number. */
  lots: AtgLotSnapshot[];
};

export type AtgRemoteStatus = "pending" | "created" | "approved" | "published" | "closed";

export type AtgAuctionLink = {
  saleId: string;
  atgAuctionId: string | null;
  remoteStatus: AtgRemoteStatus;
  payloadHash: string | null;
  lastSyncedAt: Date | null;
  closedAt: Date | null;
};

export type AtgLotLink = {
  lotId: string;
  saleId: string;
  atgLotId: string;
  imageNames: string[];
  payloadHash: string | null;
};

export type AtgPushSummary = {
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  failed: number;
};
