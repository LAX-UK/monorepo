import type { Database } from "@auction/db";
import type { NormalizedWatchlistScreening } from "../../lib/veriff/veriff-watchlist-normalizer.js";
import type {
  AmlDecision,
  AmlHoldReason,
  AmlHoldStatus,
  AmlReviewStatus,
  AmlScreeningHit,
  AmlScreeningMatchStatus,
  AmlScreeningMonitorStatus,
  AmlScreeningResult,
  AmlTriageRecommendation,
  AmlWatchlistCategory,
} from "./aml-types.js";

/**
 * Provider abstraction for the ongoing-monitoring lifecycle (Dependency
 * Inversion over the concrete Veriff client). Webhook *ingest* does not go
 * through this port — it is push-based — but enabling/disabling monitoring is
 * an outbound call the AML service owns.
 */
export interface IScreeningProvider {
  /** True when credentials are present and outbound calls are safe to attempt. */
  isConfigured(): boolean;
  /** Enrol a verified session into ongoing watchlist monitoring. */
  enableOngoingMonitoring(providerSessionId: string): Promise<void>;
  /** Remove a session from ongoing monitoring. */
  disableOngoingMonitoring(providerSessionId: string): Promise<void>;
}

/** Pull-based watchlist screening reads (GET /sessions/{id}/watchlist-screening). */
export interface IWatchlistScreeningFetcher {
  isConfigured(): boolean;
  fetchBySessionId(sessionId: string): Promise<NormalizedWatchlistScreening | null>;
}

/** Persisted watchlist screening record (one per provider session). */
export type WatchlistScreeningRecord = {
  id: string;
  userId: string;
  provider: string;
  providerSessionId: string;
  matchStatus: AmlScreeningMatchStatus;
  monitorStatus: AmlScreeningMonitorStatus;
  totalHits: number;
  categories: AmlWatchlistCategory[];
  hits: AmlScreeningHit[];
  checkType: "initial_result" | "updated_result" | null;
  decisionOutcome: AmlDecision["outcome"];
  reviewStatus: AmlReviewStatus;
  triageRecommendation: AmlTriageRecommendation | null;
  triagedByUserId: string | null;
  triagedAt: Date | null;
  triageNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  screenedAt: Date;
  createdAt: Date;
};

export interface IWatchlistScreeningReader {
  findById(id: string, conn?: Database): Promise<WatchlistScreeningRecord | null>;
  findLatestByUserId(userId: string, conn?: Database): Promise<WatchlistScreeningRecord | null>;
  findByProviderSessionId(
    providerSessionId: string,
    conn?: Database,
  ): Promise<WatchlistScreeningRecord | null>;
  listByReviewStatus(
    reviewStatus: AmlReviewStatus,
    limit: number,
    offset?: number,
    conn?: Database,
  ): Promise<WatchlistScreeningRecord[]>;
  countByReviewStatus(reviewStatus: AmlReviewStatus, conn?: Database): Promise<number>;
  listForUser(userId: string, limit: number, conn?: Database): Promise<WatchlistScreeningRecord[]>;
}

export type UpsertWatchlistScreeningInput = {
  userId: string;
  result: AmlScreeningResult;
  decision: AmlDecision;
  reviewStatus: AmlReviewStatus;
  checkType?: "initial_result" | "updated_result" | null;
};

export type WatchlistTriageInput = {
  recommendation: AmlTriageRecommendation;
  triagedByUserId: string;
  triageNotes: string | null;
};

export type WatchlistReviewOutcomeInput = {
  reviewStatus: Extract<AmlReviewStatus, "cleared" | "blocked">;
  reviewedByUserId: string;
  reviewNotes: string | null;
};

export interface IWatchlistScreeningWriter {
  /** Insert-or-update the screening record for a provider session. */
  upsertFromResult(
    input: UpsertWatchlistScreeningInput,
    conn?: Database,
  ): Promise<WatchlistScreeningRecord>;
  /** Record a first-line analyst triage recommendation (maker). */
  setTriage(
    id: string,
    input: WatchlistTriageInput,
    conn?: Database,
  ): Promise<WatchlistScreeningRecord | null>;
  /** Record an MLRO/compliance review outcome (checker / four-eyes). */
  setReviewOutcome(
    id: string,
    input: WatchlistReviewOutcomeInput,
    conn?: Database,
  ): Promise<WatchlistScreeningRecord | null>;
  setMonitorStatus(
    providerSessionId: string,
    monitorStatus: AmlScreeningMonitorStatus,
    conn?: Database,
  ): Promise<void>;
}

/**
 * Pure AML decision policy. Given a normalized screening result it returns a
 * deterministic outcome with reason codes. No I/O — trivially unit-testable and
 * Open/Closed against new list categories.
 */
export interface IAmlDecisionPolicy {
  evaluate(result: AmlScreeningResult): AmlDecision;
}

/**
 * AML hold store. Holds gate money-path progression (settlement) until a
 * compliance review clears the subject. `blocked` is terminal (confirmed
 * sanctions) and requires explicit MLRO action to lift.
 */
export interface IAmlHoldStore {
  setHold(
    userId: string,
    status: Extract<AmlHoldStatus, "hold" | "blocked">,
    reason: AmlHoldReason,
    conn?: Database,
  ): Promise<void>;
  clearHold(userId: string, conn?: Database): Promise<void>;
  getHold(
    userId: string,
    conn?: Database,
  ): Promise<{ status: AmlHoldStatus; reason: AmlHoldReason | null } | null>;
}

export type AmlWatchlistWebhookResult = {
  processed: boolean;
  outcome: AmlDecision["outcome"] | null;
};

export type AmlTriageInput = {
  screeningId: string;
  analystUserId: string;
  /** Advisory recommendation; the MLRO makes the binding decision. */
  recommendation: "clear" | "block";
  notes: string | null;
};

export type AmlReviewInput = {
  screeningId: string;
  reviewerUserId: string;
  /** `clear` lifts the hold; `block` escalates to a terminal block. */
  decision: "clear" | "block";
  notes: string | null;
};

/** Push/pull watchlist screening ingest with idempotent persistence. */
export interface IAmlWebhookIngestService {
  handleWatchlistWebhook(
    rawBody: string,
    signature: string | undefined,
    authClient: string | undefined,
  ): Promise<AmlWatchlistWebhookResult>;
  ingestFromFetch(providerSessionId: string): Promise<AmlWatchlistWebhookResult>;
}

/** MLRO/compliance review workflow and screening reads. */
export interface IAmlReviewApplicationService {
  listPendingReviews(limit?: number, offset?: number): Promise<WatchlistScreeningRecord[]>;
  countPendingReviews(): Promise<number>;
  listForUser(userId: string, limit?: number): Promise<WatchlistScreeningRecord[]>;
  triage(input: AmlTriageInput): Promise<WatchlistScreeningRecord>;
  decide(input: AmlReviewInput): Promise<WatchlistScreeningRecord>;
}

/** Ongoing watchlist monitoring lifecycle (outbound provider calls). */
export interface IAmlMonitoringService {
  isConfigured(): boolean;
  enableMonitoring(providerSessionId: string): Promise<void>;
}

export interface IAmlService
  extends IAmlWebhookIngestService,
    IAmlReviewApplicationService,
    IAmlMonitoringService {}
