import type { AmlDecision, AmlDecisionOutcome, AmlScreeningResult, WatchlistScreeningRecord } from "@auction/persistence/interfaces";
import type { NormalizedWatchlistScreening } from "../../lib/veriff/veriff-watchlist-normalizer.js";

export type { IAmlHoldStore, IWatchlistScreeningReader, IWatchlistScreeningWriter, UpsertWatchlistScreeningInput, WatchlistReviewOutcomeInput, WatchlistScreeningRecord, WatchlistTriageInput } from "@auction/persistence/interfaces";

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

/**
 * Pure AML decision policy. Given a normalized screening result it returns a
 * deterministic outcome with reason codes. No I/O — trivially unit-testable and
 * Open/Closed against new list categories.
 */
export interface IAmlDecisionPolicy {
  evaluate(result: AmlScreeningResult): AmlDecision;
}

export type AmlWatchlistWebhookResult = {
  processed: boolean;
  outcome: AmlDecisionOutcome | null;
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
