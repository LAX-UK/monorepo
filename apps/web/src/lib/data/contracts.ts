import type {
  Bid,
  Category,
  CategoryNode,
  Lot,
  LotStatus,
  PressArchiveEntry,
  PressDayMediaSaleSummary,
  PressHubMeta,
  PressSitemapSaleFreshness,
  PublicLotView,
  UserRole,
  UserStaffRole,
} from "@auction/types";

export type ListLotsParams = {
  status?: LotStatus;
  /** Comma-separated browse statuses (mirrors API `statuses` query). */
  statuses?: LotStatus[];
  categoryId?: string;
  sellerId?: string;
  winnerId?: string;
  saleId?: string;
  /** Filter to a single canonical artist via `lot.artist_id` FK. Used by the
   * admin "Lots by this artist" panel and the public artist detail rail. */
  artistId?: string;
  /** Filter lots whose endTime falls in this calendar year (UTC). */
  endYear?: number;
  /** Server-side title search (API `q`). */
  q?: string;
  /** Active lots ending within N hours (API `endingWithinHours`). */
  endingWithinHours?: number;
  /** When true, only lots with zero images. */
  needsPhotos?: boolean;
  /** When false, skip CDN URL resolution on staff list reads. */
  resolveImages?: boolean;
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
  getById(id: string): Promise<Lot | PublicLotView | null>;
}

export type PlaceBidInput = {
  lotId: string;
  amount: number;
  /** When set, stored as max auto-bid (English auction). */
  maxAutoBidAmount?: number;
  autoBidStepAmount?: number;
  /** Dedupe concurrent / retried submissions (24h server cache). */
  idempotencyKey?: string;
};

export type PlaceBidResult =
  | { ok: true; bid: Bid }
  | {
      ok: false;
      error: string;
      status: number;
      code?: string | null;
      kycFeedback?: {
        headline: string;
        detail: string | null;
        needsResubmit: boolean;
        action: "start" | "continue" | "retry" | "wait" | "none";
      } | null;
    };

/** Mutations for bids only — segregated from reads (ISP). */
export interface BidWriter {
  placeBid(input: PlaceBidInput): Promise<PlaceBidResult>;
}

export type AutoBidSettings = {
  maxAutoBidAmount: string;
  autoBidStepAmount: string | null;
  isActive: boolean;
};

/** Opening min bid returned when setAutoBid places the first bid on a lot. */
export type AutoBidPlacedBid = {
  id: string;
  amount: string;
  bidderId?: string | null;
  placedByUserId?: string | null;
  maxAutoBidAmount?: string | null;
  autoBidStepAmount?: string | null;
};

export type AutoBidMutationResult =
  | { ok: true; settings: AutoBidSettings; placedBid?: AutoBidPlacedBid }
  | {
      ok: false;
      error: string;
      status: number;
      code?: string | null;
      kycFeedback?: PlaceBidResult extends { ok: false } ? PlaceBidResult["kycFeedback"] : never;
    };

export interface AutoBidWriter {
  getAutoBid(lotId: string): Promise<AutoBidSettings | null>;
  setAutoBid(input: {
    lotId: string;
    maxAutoBidAmount: number;
    autoBidStepAmount: number;
    idempotencyKey?: string;
  }): Promise<AutoBidMutationResult>;
  clearAutoBid(lotId: string): Promise<
    | { ok: true }
    | {
        ok: false;
        error: string;
        status: number;
        code?: string | null;
        kycFeedback?: PlaceBidResult extends { ok: false } ? PlaceBidResult["kycFeedback"] : never;
      }
  >;
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  staffRole?: UserStaffRole | null;
  /** Profile / OAuth avatar when present. */
  image?: string | null;
  /** E.164 contact phone from GET /users/me. */
  mobile?: string | null;
  /** Canonical verified phone (Better Auth phoneNumber plugin). */
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean;
  /** ISO 3166-1 alpha-2 for formatting `mobile`. */
  mobileCountry?: string | null;
  /** Formatted display string from API. */
  mobileDisplay?: string | null;
  /** When true (if API exposes it), bidding UI is blocked client-side. */
  suspended?: boolean;
  emailVerified?: boolean;
  emailStatus?: "ok" | "bounced" | "complained";
  emailStatusChangedAt?: string | Date | null;
  /** From GET /users/me; omitted in client-only session shapes (treat as seen). */
  hasSeenActingContextTooltip?: boolean;
  /** From GET /users/me. Drives KYC banner + bid gating (Phase C). */
  kycStatus?: "unverified" | "pending" | "approved" | "rejected";
  /** Persona captured at signup; null for users created before Phase B. */
  signupPersona?: "individual" | "organisation" | null;
  /** From GET /users/me when a self-serve account deletion has been requested. */
  deletionRequestedAt?: string | Date | null;
  /** From GET /users/me — new address awaiting confirmation (email change flow). */
  pendingNewEmail?: string | null;
  /** From GET /users/me — TOTP / backup-code 2FA enrolment. */
  twoFactorEnabled?: boolean;
  /** From GET /users/me — synced UI preferences (theme, catalogue layout defaults, density). */
  uiPreferences?: {
    theme: "light" | "dark" | "system";
    viewLotsDefault?: "grid" | "card" | "list" | "auto";
    viewArtistsDefault?: "grid" | "card" | "list" | "auto";
    viewSalesDefault?: "grid" | "card" | "list" | "auto";
    density?: "comfortable" | "compact";
    viewSync?: boolean;
  };
};
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

export type ListPressArchiveParams = {
  limit?: number;
  offset?: number;
  year?: number;
  q?: string;
};

/** Read-only press archive for marketing hub, RSS, and sitemap helpers. */
export interface IPressArchiveReader {
  list(params?: ListPressArchiveParams): Promise<{
    data: PressArchiveEntry[];
    meta: PressHubMeta;
    unavailable?: boolean;
  }>;
  listDayMediaSales(limit?: number): Promise<PressDayMediaSaleSummary[]>;
  getSitemapFreshness(): Promise<PressSitemapSaleFreshness[]>;
}

export interface CategoryReader {
  list(): Promise<Category[]>;
  tree(): Promise<CategoryNode[]>;
}
