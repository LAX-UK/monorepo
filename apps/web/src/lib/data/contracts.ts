import type { Auction, AuctionStatus, Bid, Category } from "@auction/types";

export type ListAuctionsParams = {
  status?: AuctionStatus;
  categoryId?: string;
  sellerId?: string;
  winnerId?: string;
  limit?: number;
  offset?: number;
  /** API sort: default createdDesc; endingAsc for urgency (active lots ending soonest first). */
  sort?: "createdDesc" | "endingAsc";
};

/** Read-only auction listing and detail (ISP). */
export interface AuctionReader {
  list(params: ListAuctionsParams): Promise<Auction[]>;
  getById(id: string): Promise<Auction | null>;
}

export type PlaceBidInput = {
  auctionId: string;
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
  role: string;
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
  portraitUrl: string;
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
  role: string;
};

export interface PublicUserReader {
  getById(userId: string): Promise<PublicUser | null>;
}

export interface CategoryReader {
  list(): Promise<Category[]>;
}
