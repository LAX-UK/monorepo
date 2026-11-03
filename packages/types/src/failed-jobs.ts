import {
  DELIVERY_REPLAY_ACCESS,
  FAILED_JOBS_READ_ACCESS,
  FAILED_JOBS_WRITE_ACCESS,
  readOrWrite,
} from "./admin-access.js";
import {
  type CapabilityRequirement,
  type StaffRoles,
  requirementCapabilities,
  userHasAccessTo,
} from "./role-policy.js";

/**
 * Failed jobs: background jobs that ran out of attempts, and integration deliveries (Xero, Zoho,
 * inbound webhooks) that never went through. This is the contract between the API and the Bid
 * admin screen, so both name views, discard reasons, sources and the shapes of a job the same
 * way. Nothing here carries a raw payload: values are masked on the server.
 */

/**
 * Where a failure comes from. Each source is one access scope: who may see its rows and who may
 * retry or discard them. Adding a source is one entry here and one row in the access table.
 */
export const FAILED_JOB_SOURCES = [
  "background_jobs",
  "integrations.xero",
  "integrations.zoho",
  "integrations.other",
] as const;
export type FailedJobSource = (typeof FAILED_JOB_SOURCES)[number];

/** What the Source filter offers: the two kinds of failure, whatever the integration. */
export const FAILED_JOB_SOURCE_FAMILIES = ["background_jobs", "integrations"] as const;
export type FailedJobSourceFamily = (typeof FAILED_JOB_SOURCE_FAMILIES)[number];

export const FAILED_JOB_SOURCE_FAMILY_LABELS: Readonly<Record<FailedJobSourceFamily, string>> = {
  background_jobs: "Background jobs",
  integrations: "Integrations",
};

export function isFailedJobSourceFamily(value: string): value is FailedJobSourceFamily {
  return (FAILED_JOB_SOURCE_FAMILIES as readonly string[]).includes(value);
}

export function failedJobSourceFamily(source: FailedJobSource): FailedJobSourceFamily {
  return source === "background_jobs" ? "background_jobs" : "integrations";
}

/** The job id carries its source: `job:` for background jobs, `delivery:` and `webhook:` for integrations. */
export const FAILED_JOB_ID_PREFIXES = {
  job: "job:",
  delivery: "delivery:",
  webhook: "webhook:",
} as const;

export type FailedJobSourceAccess = {
  /** Who may see the source's rows. */
  read: CapabilityRequirement;
  /** Who may retry, discard and restore them. */
  act: CapabilityRequirement;
};

/**
 * Per source, who reads and who acts. Administrators do everything, Finance handles Xero (its own
 * invoice and payment sync), and read-only staff may look at every source and change nothing.
 * One table, so the API and the screen cannot disagree.
 */
export const FAILED_JOB_SOURCE_ACCESS: Readonly<Record<FailedJobSource, FailedJobSourceAccess>> = {
  background_jobs: { read: FAILED_JOBS_READ_ACCESS, act: FAILED_JOBS_WRITE_ACCESS },
  "integrations.xero": {
    read: readOrWrite("finance.read"),
    act: "finance.platform.write",
  },
  "integrations.zoho": { read: readOrWrite(DELIVERY_REPLAY_ACCESS), act: DELIVERY_REPLAY_ACCESS },
  "integrations.other": { read: readOrWrite(DELIVERY_REPLAY_ACCESS), act: DELIVERY_REPLAY_ACCESS },
};

function anyOfEvery(pick: (access: FailedJobSourceAccess) => CapabilityRequirement) {
  const capabilities = new Set(
    FAILED_JOB_SOURCES.flatMap((source) =>
      requirementCapabilities(pick(FAILED_JOB_SOURCE_ACCESS[source])),
    ),
  );
  return { anyOf: [...capabilities] } as CapabilityRequirement;
}

/** Opens the Failed jobs page: reading at least one source. */
export const FAILED_JOBS_ANY_SOURCE_READ_ACCESS: CapabilityRequirement = anyOfEvery(
  (access) => access.read,
);

/** Acting on at least one source; the sources a person may act on are narrower still. */
export const FAILED_JOBS_ANY_SOURCE_ACT_ACCESS: CapabilityRequirement = anyOfEvery(
  (access) => access.act,
);

/** The sources a person may see (`read`) or change (`act`). */
export function failedJobSourcesFor(
  staffRoles: StaffRoles | undefined,
  mode: keyof FailedJobSourceAccess,
): FailedJobSource[] {
  return FAILED_JOB_SOURCES.filter((source) =>
    userHasAccessTo("staff", staffRoles, FAILED_JOB_SOURCE_ACCESS[source][mode]),
  );
}

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
  /** Prefixed by source: `job:`, `delivery:` or `webhook:`. */
  id: string;
  source: FailedJobSource;
  /** The person may retry and discard this one; false means they may only look. */
  canAct: boolean;
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
  /** The kinds of failure the person may see, with a count each, for the Source filter. */
  sources: { id: FailedJobSourceFamily; label: string; count: number }[];
  /** The person may act on at least one source; otherwise the list is view only. */
  canAct: boolean;
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
