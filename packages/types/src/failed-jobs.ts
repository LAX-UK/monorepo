/**
 * Failed jobs: background jobs that ran out of attempts. This is the contract between the API
 * and the Bid admin screen, so both name views, discard reasons and the shapes of a job the same
 * way. Nothing here carries a raw payload: values are masked on the server.
 */

export const FAILED_JOB_VIEW_IDS = ["needs_review", "retried", "discarded"] as const;
export type FailedJobView = (typeof FAILED_JOB_VIEW_IDS)[number];

export function isFailedJobView(value: string): value is FailedJobView {
  return (FAILED_JOB_VIEW_IDS as readonly string[]).includes(value);
}

export const FAILED_JOB_VIEW_LABELS: Readonly<Record<FailedJobView, string>> = {
  needs_review: "Needs review",
  retried: "Retried",
  discarded: "Discarded",
};

/** Why someone set a failed job aside. `other` needs a note so the log stays useful. */
export const FAILED_JOB_DISCARD_REASONS = [
  "fixed_another_way",
  "not_needed",
  "cannot_succeed",
  "duplicate",
  "test_data",
  "other",
] as const;
export type FailedJobDiscardReason = (typeof FAILED_JOB_DISCARD_REASONS)[number];

export const FAILED_JOB_DISCARD_REASON_OPTIONS: Readonly<
  Record<FailedJobDiscardReason, { label: string; hint?: string }>
> = {
  fixed_another_way: {
    label: "Fixed another way",
    hint: "For example, the email was sent by hand",
  },
  not_needed: { label: "Not needed any more" },
  cannot_succeed: {
    label: "Can't succeed",
    hint: "Bad data or an address that can't receive mail",
  },
  duplicate: { label: "Duplicate" },
  test_data: { label: "Test or demo data" },
  other: { label: "Other", hint: "A note is required" },
};

export function isFailedJobDiscardReason(value: string): value is FailedJobDiscardReason {
  return (FAILED_JOB_DISCARD_REASONS as readonly string[]).includes(value);
}

export const FAILED_JOB_NOTE_MAX = 500;
export const FAILED_JOB_BATCH_MAX = 50;

export type FailedJobState = FailedJobView;

/** Whether a retry is possible now, and when it is not, what to tell the person. */
export type FailedJobRetryAvailability = { allowed: true } | { allowed: false; reason: string };

/** One row of the list. */
export type FailedJobSummary = {
  id: string;
  queue: string;
  /** Plain-language job type, from one registry. */
  typeLabel: string;
  /** The job name as a readable phrase, when it adds to the type. */
  jobLabel: string | null;
  /** Where it ran, for the second line: "Background job · Email". */
  sourceLabel: string;
  /** One line, with emails, tokens and long identifiers removed. */
  errorSummary: string;
  attempts: number;
  firstFailedAt: string;
  lastFailedAt: string;
  state: FailedJobState;
  /** May repeat something a person sees (an email, a payment sync). */
  mayRepeat: boolean;
  retry: FailedJobRetryAvailability;
};

export type FailedJobPayloadEntry = {
  label: string;
  value: string;
  /** Shown as a partial value: the full one stays with the record's own access rules. */
  masked: boolean;
};

export type FailedJobHistoryEvent = {
  id: string;
  kind: "retried" | "discarded" | "restored";
  at: string;
  actorName: string | null;
  /** The reason label and note for a discard; empty otherwise. */
  detail: string | null;
};

export type FailedJobDetail = FailedJobSummary & {
  /** What a retry does, in a sentence per job type. */
  retryEffect: string;
  /** The full error text, scrubbed of emails, tokens and long identifiers. */
  errorMessage: string;
  originalJobId: string | null;
  payload: FailedJobPayloadEntry[];
  /** Fields left out of the masked view. */
  omittedPayloadFields: number;
  discard: { reasonLabel: string; note: string | null; at: string; byName: string | null } | null;
  history: FailedJobHistoryEvent[];
};

export type FailedJobFacetOption = { id: string; label: string; count: number };

export type FailedJobList = {
  rows: FailedJobSummary[];
  /** Rows matching the filters in the chosen view, for paging. */
  total: number;
  /** Rows in each view under the other filters, for the view tabs. */
  counts: Record<FailedJobView, number>;
  queues: FailedJobFacetOption[];
  /** False when an operator has switched retries and discards off. */
  actionsEnabled: boolean;
};

export type FailedJobBatchOutcome =
  | { id: string; ok: true }
  | { id: string; ok: false; error: string };

export type FailedJobBatchResult = { results: FailedJobBatchOutcome[] };
