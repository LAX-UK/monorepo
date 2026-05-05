import type { Bid, Category, Lot, LotStatus, UserRole } from "@auction/types";

export type ListLotsParams = {
  status?: LotStatus;
  categoryId?: string;
  sellerId?: string;
  winnerId?: string;
  saleId?: string;
  /** Filter lots whose endTime falls in this calendar year (UTC). */
  endYear?: number;
  /** Server-side title search (API `q`). */
  q?: string;
  limit?: number;
  offset?: number;
  /** API sort: default createdDesc; endingAsc for live urgency; hammerDesc/endedDesc for archive. */
  sort?: "createdDesc" | "endingAsc" | "hammerDesc" | "endedDesc" | "sellerAsc";
};

/** Aggregates for past / ended lots (ISP: separate from row listing). */
export type ArchiveEndedSummary = {
  totalHammer: string;
  endedLotCount: number;
};

export interface ArchiveMetricsReader {
  getEndedSummary(endYear?: number): Promise<ArchiveEndedSummary>;
  countEndedLots(filters: { categoryId?: string; endYear?: number }): Promise<number>;
}

/** Read-only lot listing and detail (ISP). */
export interface LotReader {
  list(params: ListLotsParams): Promise<Lot[]>;
  getById(id: string): Promise<Lot | null>;
}

export type PlaceBidInput = {
  lotId: string;
  amount: number;
  /** When set, stored as max auto-bid (English auction). */
  maxAutoBidAmount?: number;
};

export type PlaceBidResult = { ok: true; bid: Bid } | { ok: false; error: string; status: number };

/** Mutations for bids only — segregated from reads (ISP). */
export interface BidWriter {
  placeBid(input: PlaceBidInput): Promise<PlaceBidResult>;
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Profile / OAuth avatar when present. */
  image?: string | null;
  /** When true (if API exposes it), bidding UI is blocked client-side. */
  suspended?: boolean;
  emailVerified?: boolean;
  emailStatus?: "ok" | "bounced" | "complained";
  emailStatusChangedAt?: string | Date | null;
};

/** Session / “who am I” without exposing auth client (DIP). */
export interface SessionReader {
  getSession(): Promise<SessionUser | null>;
}

export type ArtistProfile = {
  id: string;
  name: string;
  tagline: string;
  bio: string;
  portraitUrl: string | null;
  /** Display line above the name (e.g. medium category). Falls back to Medium stat when omitted. */
  discipline?: string;
  stats: { label: string; value: string }[];
};

/** Until a public artist API exists, swap implementations (LSP-friendly mock). */
export interface ArtistReader {
  getById(id: string): Promise<ArtistProfile | null>;
  listFeatured(): Promise<ArtistProfile[]>;
}

/** Public seller / user snippet for lot pages */
export type PublicUser = {
  id: string;
  name: string;
  /** Profile / OAuth avatar when present */
  image?: string | null;
  /** Omitted from public API responses (defense in depth). */
  role?: string;
};

export interface PublicUserReader {
  getById(userId: string): Promise<PublicUser | null>;
}

export interface CategoryReader {
  list(): Promise<Category[]>;
}
