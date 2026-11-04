/**
 * Integration deliveries that did not go through, as the Failed jobs screen reads them: domain
 * events a consumer (Xero, Zoho) gave up delivering, and inbound webhooks that never processed.
 * A decision on one (retried, discarded) is kept beside the record under its prefixed id, in the
 * same store as background jobs, so the views and the audit are the same.
 */

export type IntegrationKind = "delivery" | "webhook";

/** One failed delivery or webhook with the decision recorded on it, if any. */
export type IntegrationDeadLetterRecord = {
  /** `delivery:<id>` or `webhook:<id>`. */
  id: string;
  kind: IntegrationKind;
  /** The consumer for a delivery (`xero`), the sender for a webhook (`stripe`). */
  name: string;
  /** The domain event type for a delivery, the event type a webhook announces; null if unknown. */
  eventType: string | null;
  /** A webhook's event key, which retrying it needs; null for a delivery. */
  eventKey: string | null;
  /** Already redacted when it was stored. */
  errorMessage: string | null;
  attempts: number;
  firstFailedAt: Date;
  failedAt: Date;
  /** Still failing now; false once a retry has put it back in flight. */
  failing: boolean;
  replayedAt: Date | null;
  replayedBy: string | null;
  discardedAt: Date | null;
  discardedBy: string | null;
  discardReason: string | null;
  discardNote: string | null;
};

export type IntegrationDeadLetterWithPayload = IntegrationDeadLetterRecord & {
  /** The stored event or webhook body; masked before it leaves the API. */
  payload: unknown;
};

export type IntegrationView = "needs_review" | "retried" | "discarded";

/** A set of names to match or to leave out; null means every name. */
export type IntegrationNameFilter = { mode: "in" | "not_in"; names: readonly string[] };

/** Which deliveries and webhooks the caller may see, by consumer and by sender. */
export type IntegrationScope = {
  deliveries: IntegrationNameFilter | null;
  webhooks: IntegrationNameFilter | null;
};

export type IntegrationSearch = {
  view: IntegrationView;
  sort: "failed_desc" | "failed_asc";
  limit: number;
  offset: number;
  scope: IntegrationScope;
  q?: string;
  /** One consumer or sender, as `delivery:xero` or `webhook:stripe`. */
  queue?: string;
  fromDay?: string;
  toDay?: string;
};

export type IntegrationSearchResult = {
  rows: IntegrationDeadLetterRecord[];
  total: number;
  counts: Record<IntegrationView, number>;
  /** Rows per consumer or sender in the chosen view, under the other filters. */
  queues: { kind: IntegrationKind; name: string; count: number }[];
};

/** A webhook that arrived and failed, as the engineers' dead-letter list reads it. */
export type FailedWebhookRow = {
  id: string;
  source: string;
  eventKey: string;
  attempts: number;
  lastError: string | null;
  receivedAt: Date;
};

export interface IIntegrationDeadLetterReader {
  /** Unprocessed webhooks that carry an error, oldest first. */
  listFailedWebhooks(input: { limit: number; offset: number }): Promise<FailedWebhookRow[]>;
  search(input: IntegrationSearch): Promise<IntegrationSearchResult>;
  findForReview(id: string): Promise<IntegrationDeadLetterWithPayload | null>;
  findManyForReview(ids: readonly string[]): Promise<IntegrationDeadLetterRecord[]>;
}

/** What the disposition store needs to start a record for a delivery it has not seen yet. */
export type IntegrationDispositionSeed = {
  id: string;
  attempts: number;
  failedAt: Date;
  firstFailedAt: Date;
};

/** Records retries and discards of integration deliveries, keyed by prefixed id. */
export interface IIntegrationDeadLetterDisposition {
  /**
   * Claims a retry: true for the one caller that gets to run it, false when it was already
   * retried since it last failed, or was discarded. Two people retrying at once run it once.
   */
  claimRetry(seed: IntegrationDispositionSeed, byUserId: string): Promise<boolean>;
  /** Gives a claim back when the retry could not be started. */
  releaseRetry(id: string): Promise<void>;
  /** Discards records still waiting for review; returns the ids that changed. */
  discard(input: {
    seeds: readonly IntegrationDispositionSeed[];
    byUserId: string;
    reason: string;
    note: string | null;
  }): Promise<string[]>;
  /** Puts discarded records back in review; returns the ids that changed. */
  restore(ids: readonly string[]): Promise<string[]>;
}

/** Starts a failed webhook over; its worker picks it up again. */
export interface IWebhookRetryQueue {
  requeue(eventKey: string): Promise<void>;
}
