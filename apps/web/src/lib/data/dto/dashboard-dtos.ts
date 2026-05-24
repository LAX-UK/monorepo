/**
 * Dashboard-facing DTOs — pages and view-models import from here, not from `*.server.ts`.
 * Keeps the composition root (`getServerDataContainer`) decoupled from HTTP module boundaries.
 */
import type { Bid, Lot } from "@auction/types";

export type BidWithLot = {
  bid: Bid;
  lot: Lot | null;
};

export type WatchlistWithLotRow = {
  watchlistId: string;
  lotId: string;
  createdAt: Date;
  lot: Lot | null;
};

export type WatchlistListParams = {
  sort?: "addedDesc" | "endingSoon" | "priceAsc" | "priceDesc";
  status?: "active" | "scheduled" | "ended";
  categoryIds?: string[];
};

export type ArtistFollowRow = {
  watchlistId: string;
  artistId: string;
  createdAt: Date;
};

/** Mirrors API `KycStatusSummary` (dates as ISO strings over the wire). */
export type KycUserFeedbackDto = {
  headline: string;
  detail: string | null;
  action: "start" | "continue" | "retry" | "wait" | "none";
  reasonCode: number | null;
  decisionStatus: string | null;
  needsResubmit: boolean;
};

export type KycStatusSummaryDto = {
  status: "unverified" | "pending" | "approved" | "rejected";
  verifiedAt: string | null;
  latestSessionId: string | null;
  latestSessionStatus: "created" | "requires_input" | "processing" | "verified" | "canceled" | null;
  feedback: KycUserFeedbackDto;
  pendingExposure: { total: number; currency: string };
  thresholdAmount: number;
  thresholdCurrency: string;
  requiresKyc: boolean;
};

export type OrgOnboardingResumeVm = {
  entityId: string;
  displayName: string;
  resumeHref: string;
};

export type { ProfileAddressRow } from "@/components/dashboard/profile-settings-board";
