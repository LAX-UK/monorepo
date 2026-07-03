import type { LotStatus, Sale, SaleStatus } from "@auction/types";

export type ListLotsSort =
  | "createdDesc"
  | "endingAsc"
  | "hammerDesc"
  | "endedDesc"
  /** Seller display name A–Z (joins user; stable tie-break on endTime desc). */
  | "sellerAsc";

export type ListLotsFilter = {
  status?: LotStatus | undefined;
  statuses?: LotStatus[] | undefined;
  categoryId?: string | undefined;
  categoryIds?: string[] | undefined;
  sellerLegalEntityId?: string | undefined;
  winnerId?: string | undefined;
  saleId?: string | undefined;
  /** Filter to lots whose `artist_id` FK matches. Used by the admin artist
   * edit page ("Lots by this artist" panel) and the public artist detail rail. */
  artistId?: string | undefined;
  /** Restrict lots whose endTime falls in this calendar year (UTC). */
  endYear?: number | undefined;
  /** Active lots ending within N hours from now (catalogue urgency filter). */
  endingWithinHours?: number | undefined;
  /** Case-insensitive substring match on title (public catalogue search). */
  /** When true, only lots on public parent sales (standalone lots allowed). */
  requirePublicParentSale?: boolean | undefined;
  search?: string | undefined;
  /** When true, only lots with no images (draft triage). */
  needsPhotos?: boolean | undefined;
  /** When false, skip CDN URL resolution (staff list views). */
  resolveImages?: boolean | undefined;
  limit: number;
  offset: number;
  sort?: ListLotsSort | undefined;
};

export type ListSalesSort = "createdDesc" | "startAsc";

export type ListSalesFilter = {
  status?: SaleStatus | undefined;
  statuses?: SaleStatus[] | undefined;
  categoryId?: string | undefined;
  categoryIds?: string[] | undefined;
  /** Case-insensitive substring on title (staff lists). */
  q?: string | undefined;
  deliveryMode?: Sale["deliveryMode"] | undefined;
  /** Applies to ended sales — filters by buyer payment settlement on sold lots. */
  settlementStatus?: "settled" | "unsettled" | undefined;
  /** Draft sales missing lots or onsite venue details. */
  needsSetup?: boolean | undefined;
  limit: number;
  offset: number;
  sort?: ListSalesSort | undefined;
};

/** Aggregate for archive / past-auctions views (ended lots). */
export type ArchiveEndedAggregateFilter = {
  endYear?: number | undefined;
};
