import type { DocumentKind } from "./document.js";
import type { IssueOutcome, IssuedDocument, LookupOutcome } from "./ports.js";
import { type Result, ok, refuse } from "./result.js";

export const STATUSES = [
  "pending",
  "sending",
  "issued",
  "unknown",
  "needs_review",
  "failed",
  "cancelled",
] as const;
export type Status = (typeof STATUSES)[number];

/** Who is allowed to send, and until when (epoch milliseconds). Plain data; the clock is the caller's. */
export interface Lease {
  readonly token: string;
  readonly expiresAtMs: number;
}

export interface DocumentRecord {
  readonly kind: DocumentKind;
  readonly reference: string;
  readonly status: Status;
  readonly lease: Lease | null;
  readonly attempts: number;
  readonly issued: IssuedDocument | null;
  readonly failureReason: string | null;
  /** True once a send may have reached the provider and no lookup has since ruled it out. */
  readonly lookupRequired: boolean;
}

export type LifecycleCode =
  | "bad_state"
  | "lease_held"
  | "lease_mismatch"
  | "lookup_required"
  | "bad_lease"
  | "bad_lookup_state";

export function newRecord(kind: DocumentKind, reference: string): DocumentRecord {
  return {
    kind,
    reference,
    status: "pending",
    lease: null,
    attempts: 0,
    issued: null,
    failureReason: null,
    lookupRequired: false,
  };
}

function wrongState(action: string, status: Status) {
  return refuse("bad_state", `cannot ${action} from ${status}`);
}

export function isLeaseExpired(lease: Lease, nowMs: number): boolean {
  return nowMs >= lease.expiresAtMs;
}

/**
 * pending -> sending, or unknown -> sending once a lookup has ruled the document out. Takes the
 * lease. An unknown record that has not been looked up is refused: lookup comes before any retry.
 */
export function startSending(
  record: DocumentRecord,
  lease: Lease,
  nowMs: number,
): Result<DocumentRecord, LifecycleCode> {
  if (lease.token === "" || lease.expiresAtMs <= nowMs) {
    return refuse("bad_lease", "lease needs a token and an expiry in the future");
  }
  if (record.status === "sending") {
    return refuse("lease_held", "another sender holds this document");
  }
  if (record.lookupRequired) {
    return refuse("lookup_required", "look the document up by its LAX reference before retrying");
  }
  if (record.status !== "pending" && record.status !== "unknown") {
    return wrongState("start sending", record.status);
  }
  return ok({ ...record, status: "sending", lease, attempts: record.attempts + 1 });
}

/** An expired lease means the sender is gone mid-flight: the outcome is unknown. */
export function expireLease(
  record: DocumentRecord,
  nowMs: number,
): Result<DocumentRecord, LifecycleCode> {
  if (record.status !== "sending" || record.lease === null) {
    return wrongState("expire a lease", record.status);
  }
  if (!isLeaseExpired(record.lease, nowMs)) {
    return refuse("lease_held", "lease has not expired");
  }
  return ok(toUnknown(record));
}

function toUnknown(record: DocumentRecord): DocumentRecord {
  return { ...record, status: "unknown", lease: null, lookupRequired: true };
}

/**
 * Apply the provider's answer to a send. Needs the lease token. If the lease has expired by the
 * time the answer arrives, the answer is not trusted: the record becomes unknown and lookup decides.
 */
export function completeSending(
  record: DocumentRecord,
  token: string,
  outcome: IssueOutcome,
  nowMs: number,
): Result<DocumentRecord, LifecycleCode> {
  if (record.status !== "sending" || record.lease === null) {
    return wrongState("complete a send", record.status);
  }
  if (record.lease.token !== token) {
    return refuse("lease_mismatch", "lease token does not match");
  }
  if (isLeaseExpired(record.lease, nowMs) || outcome.status === "unknown") {
    return ok(toUnknown(record));
  }
  if (outcome.status === "rejected") {
    return ok({ ...record, status: "failed", lease: null, failureReason: outcome.reason });
  }
  return ok({
    ...record,
    status: "issued",
    lease: null,
    lookupRequired: false,
    failureReason: null,
    issued: { number: outcome.number, providerId: outcome.providerId, pdfRef: outcome.pdfRef },
  });
}

/**
 * Record a lookup by LAX reference (allowed from unknown, or needs_review while a lookup is owed).
 * found -> issued; not_found clears the lookup duty so a retry is allowed; ambiguous -> needs_review;
 * unavailable changes nothing.
 */
export function applyLookup(
  record: DocumentRecord,
  outcome: LookupOutcome,
): Result<DocumentRecord, LifecycleCode> {
  if (!record.lookupRequired || (record.status !== "unknown" && record.status !== "needs_review")) {
    return refuse("bad_lookup_state", `no lookup is owed from ${record.status}`);
  }
  switch (outcome.status) {
    case "found":
      return ok({
        ...record,
        status: "issued",
        lookupRequired: false,
        failureReason: null,
        issued: { number: outcome.number, providerId: outcome.providerId, pdfRef: outcome.pdfRef },
      });
    case "not_found":
      return ok({ ...record, lookupRequired: false });
    case "ambiguous":
      return ok({
        ...record,
        status: "needs_review",
        failureReason: `${outcome.count} documents carry this reference`,
      });
    case "unavailable":
      return ok(record);
  }
}

/** A person (or a rule) takes the record out of automation. Not from a finished or cancelled one. */
export function escalate(
  record: DocumentRecord,
  reason: string,
): Result<DocumentRecord, LifecycleCode> {
  if (record.status !== "unknown" && record.status !== "failed") {
    return wrongState("escalate", record.status);
  }
  return ok({ ...record, status: "needs_review", failureReason: reason });
}

/**
 * failed -> pending (the provider refused it outright, so nothing exists to duplicate).
 * needs_review -> pending only when no lookup is owed. unknown goes through applyLookup/startSending.
 */
export function requeue(record: DocumentRecord): Result<DocumentRecord, LifecycleCode> {
  if (record.status !== "failed" && record.status !== "needs_review") {
    return wrongState("requeue", record.status);
  }
  if (record.lookupRequired) {
    return refuse("lookup_required", "look the document up by its LAX reference before requeueing");
  }
  return ok({ ...record, status: "pending", failureReason: null });
}

/** Stop a document that was never sent, or one that failed or needs review with nothing owed. */
export function cancel(record: DocumentRecord): Result<DocumentRecord, LifecycleCode> {
  if (record.status === "pending" || record.status === "failed") {
    return ok({ ...record, status: "cancelled", lease: null });
  }
  if (record.status === "needs_review" && !record.lookupRequired) {
    return ok({ ...record, status: "cancelled", lease: null });
  }
  if (record.status === "needs_review" || record.status === "unknown") {
    return refuse("lookup_required", "it may exist in the provider; look it up first");
  }
  return wrongState("cancel", record.status);
}
