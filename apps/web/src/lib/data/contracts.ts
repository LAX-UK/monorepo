import type { Auction, AuctionStatus, Bid } from "@auction/types";

export type ListAuctionsParams = {
  status?: AuctionStatus;
  categoryId?: string;
  sellerId?: string;
  limit?: number;
  offset?: number;
};

/** Read-only auction listing and detail (ISP). */
export interface AuctionReader {
  list(params: ListAuctionsParams): Promise<Auction[]>;
  getById(id: string): Promise<Auction | null>;
}

export type PlaceBidInput = {
  auctionId: string;
  amount: number;
};

export type PlaceBidResult = { ok: true; bid: Bid } | { ok: false; error: string; status: number };

/** Mutations for bids only — segregated from reads (ISP). */
export interface BidWriter {
  placeBid(input: PlaceBidInput): Promise<PlaceBidResult>;
}

export type SessionUser = {
  id: string;
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
}
