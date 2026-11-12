import { type DocumentKind, parseLaxReference } from "./document.js";
import { type Totals, compareWithProviderTotals, isTotals } from "./money.js";
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

/** Longest a lease may run. A longer one is almost certainly a unit mistake. */
export const MAX_LEASE_MS = 60 * 60 * 1000;
/**
 * How long after a lease expires the first request is still allowed to land in the provider. The
 * runtime's HTTP timeout must be shorter than the lease; this grace covers provider-side work that
 * outlives a client timeout. A lookup that finds nothing is trusted only after it.
 */
export const SETTLE_GRACE_MS = 60 * 1000;

export interface TotalsMismatch {
  readonly field: keyof Totals;
  readonly differencePence: number;
}

interface Core {
  readonly kind: DocumentKind;
  readonly reference: string;
  readonly attempts: number;
}

/**
 * One shape per status, so an illegal combination cannot be written down. `unknown` always owes a
 * lookup and always knows when the first request has settled; `needs_review` either still owes a
 * lookup (`lookup: "owed"`) or does not (`lookup: "clear"`, and then it carries the provider's
 * document if one exists, which a person must handle: it is never requeued or cancelled).
 */
export type DocumentRecord = Core &
  (
    | { readonly status: "pending" }
    | { readonly status: "sending"; readonly lease: Lease }
    | { readonly status: "issued"; readonly issued: IssuedDocument }
    | { readonly status: "unknown"; readonly settlesAtMs: number }
    | {
        readonly status: "needs_review";
        readonly reason: string;
        readonly lookup: "owed";
        readonly settlesAtMs: number;
      }
    | {
        readonly status: "needs_review";
        readonly reason: string;
        readonly lookup: "clear";
        readonly issued: IssuedDocument | null;
        readonly mismatch: TotalsMismatch | null;
      }
    | { readonly status: "failed"; readonly reason: string }
    | { readonly status: "cancelled" }
  );

export type LifecycleCode =
  | "bad_state"
  | "lease_held"
  | "lease_mismatch"
  | "lookup_required"
  | "lookup_too_early"
  | "bad_lease"
  | "bad_time"
  | "bad_lookup_state"
  | "bad_outcome"
  | "bad_record";

export function newRecord(kind: DocumentKind, reference: string): DocumentRecord {
  return { kind, reference, attempts: 0, status: "pending" };
}

function wrongState(action: string, status: Status) {
  return refuse("bad_state", `cannot ${action} from ${status}`);
}

function isTime(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function badTime() {
  return refuse("bad_time", "times are whole epoch milliseconds");
}

export function isLeaseExpired(lease: Lease, nowMs: number): boolean {
  return nowMs >= lease.expiresAtMs;
}

function toUnknown(record: DocumentRecord & { status: "sending" }): DocumentRecord {
  const { lease: _lease, ...core } = record;
  return {
    kind: core.kind,
    reference: core.reference,
    attempts: core.attempts,
    status: "unknown",
    settlesAtMs: record.lease.expiresAtMs + SETTLE_GRACE_MS,
  };
}

function core(record: DocumentRecord): Core {
  return { kind: record.kind, reference: record.reference, attempts: record.attempts };
}

/**
 * pending -> sending. Takes the lease. An unknown record is refused with `lookup_required`: it goes
 * through `applyLookup`, and only a `not_found` after the settle time makes it pending again.
 */
export function startSending(
  record: DocumentRecord,
  lease: Lease,
  nowMs: number,
): Result<DocumentRecord, LifecycleCode> {
  if (!isTime(nowMs) || !isTime(lease.expiresAtMs)) return badTime();
  if (typeof lease.token !== "string" || lease.token === "" || lease.expiresAtMs <= nowMs) {
    return refuse("bad_lease", "lease needs a token and an expiry in the future");
  }
  if (lease.expiresAtMs - nowMs > MAX_LEASE_MS) {
    return refuse("bad_lease", "lease is longer than the maximum");
  }
  if (record.status === "sending") {
    return refuse("lease_held", "another sender holds this document");
  }
  if (
    record.status === "unknown" ||
    (record.status === "needs_review" && record.lookup === "owed")
  ) {
    return refuse("lookup_required", "look the document up by its LAX reference before retrying");
  }
  if (record.status !== "pending") return wrongState("start sending", record.status);
  return ok({ ...core(record), attempts: record.attempts + 1, status: "sending", lease });
}

/** An expired lease means the sender is gone mid-flight: the outcome is unknown. */
export function expireLease(
  record: DocumentRecord,
  nowMs: number,
): Result<DocumentRecord, LifecycleCode> {
  if (!isTime(nowMs)) return badTime();
  if (record.status !== "sending") return wrongState("expire a lease", record.status);
  if (!isLeaseExpired(record.lease, nowMs)) return refuse("lease_held", "lease has not expired");
  return ok(toUnknown(record));
}

function reviewFromProvider(
  record: DocumentRecord,
  document: IssuedDocument,
  mismatch: TotalsMismatch,
): DocumentRecord {
  return {
    ...core(record),
    status: "needs_review",
    lookup: "clear",
    issued: document,
    mismatch,
    reason: `provider total differs: ${mismatch.field} by ${mismatch.differencePence} pence`,
  };
}

/**
 * Issued if the provider's totals equal ours exactly; otherwise needs_review, identity kept.
 * Totals that are missing or not whole pence are refused with `bad_outcome` and the record is
 * left as it was, so the caller can retry the lookup; nothing unreadable is ever produced.
 */
function acceptProviderDocument(
  record: DocumentRecord,
  provider: IssuedDocument & { readonly totals: Totals },
  expected: Totals,
): Result<DocumentRecord, LifecycleCode> {
  if (!isTotals(provider?.totals) || !isTotals(expected)) {
    return refuse("bad_outcome", "provider totals must be whole pence; nothing was recorded");
  }
  const document: IssuedDocument = {
    number: provider.number,
    providerId: provider.providerId,
    pdfRef: provider.pdfRef,
  };
  const match = compareWithProviderTotals(expected, provider.totals);
  if (!match.matches) {
    return ok(
      reviewFromProvider(record, document, {
        field: match.field,
        differencePence: match.differencePence,
      }),
    );
  }
  return ok({ ...core(record), status: "issued", issued: document });
}

/**
 * Apply the provider's answer to a send. Needs the lease token and the totals we expect. If the
 * lease has expired by the time the answer arrives, the answer is not trusted: the record becomes
 * unknown and lookup decides. An issued answer whose totals differ from ours goes to needs_review
 * with the provider's identity kept (the document exists and must not be sent again).
 */
export function completeSending(
  record: DocumentRecord,
  token: string,
  outcome: IssueOutcome,
  nowMs: number,
  expected: Totals,
): Result<DocumentRecord, LifecycleCode> {
  if (!isTime(nowMs)) return badTime();
  if (record.status !== "sending") return wrongState("complete a send", record.status);
  if (record.lease.token !== token) return refuse("lease_mismatch", "lease token does not match");
  if (isLeaseExpired(record.lease, nowMs) || outcome.status === "unknown") {
    return ok(toUnknown(record));
  }
  if (outcome.status === "rejected") {
    return ok({ ...core(record), status: "failed", reason: outcome.reason });
  }
  return acceptProviderDocument(record, outcome, expected);
}

/**
 * Record a lookup by LAX reference (allowed from unknown, or needs_review while a lookup is owed).
 * found -> issued, or needs_review if its totals differ from ours. not_found is accepted only once
 * the first request has settled (`nowMs >= settlesAtMs`); earlier it is refused with
 * `lookup_too_early`, because the request may still land. After that it makes the record pending
 * again (from unknown) or clears the duty (from needs_review). ambiguous -> needs_review with the
 * lookup still owed. unavailable changes nothing.
 */
export function applyLookup(
  record: DocumentRecord,
  outcome: LookupOutcome,
  nowMs: number,
  expected: Totals,
): Result<DocumentRecord, LifecycleCode> {
  if (!isTime(nowMs)) return badTime();
  const owed =
    record.status === "unknown" || (record.status === "needs_review" && record.lookup === "owed");
  if (!owed) return refuse("bad_lookup_state", `no lookup is owed from ${record.status}`);
  switch (outcome.status) {
    case "found":
      return acceptProviderDocument(record, outcome, expected);
    case "not_found":
      if (nowMs < record.settlesAtMs) {
        return refuse(
          "lookup_too_early",
          "the first request may still land; look again after it has settled",
        );
      }
      if (record.status === "unknown") return ok({ ...core(record), status: "pending" });
      return ok({
        ...core(record),
        status: "needs_review",
        lookup: "clear",
        issued: null,
        mismatch: null,
        reason: record.reason,
      });
    case "ambiguous":
      return ok({
        ...core(record),
        status: "needs_review",
        lookup: "owed",
        settlesAtMs: record.settlesAtMs,
        reason: `${outcome.count} documents carry this reference`,
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
  if (record.status === "unknown") {
    return ok({
      ...core(record),
      status: "needs_review",
      lookup: "owed",
      settlesAtMs: record.settlesAtMs,
      reason,
    });
  }
  if (record.status === "failed") {
    return ok({
      ...core(record),
      status: "needs_review",
      lookup: "clear",
      issued: null,
      mismatch: null,
      reason,
    });
  }
  return wrongState("escalate", record.status);
}

/**
 * failed -> pending (the provider refused it outright, so nothing exists to duplicate).
 * needs_review -> pending only when no lookup is owed and the provider holds no document for it.
 * unknown goes through applyLookup.
 */
export function requeue(record: DocumentRecord): Result<DocumentRecord, LifecycleCode> {
  if (record.status === "failed") return ok({ ...core(record), status: "pending" });
  if (record.status !== "needs_review") return wrongState("requeue", record.status);
  if (record.lookup === "owed") {
    return refuse("lookup_required", "look the document up by its LAX reference before requeueing");
  }
  if (record.issued !== null) {
    return refuse(
      "bad_state",
      "the provider already holds this document; a person must resolve it",
    );
  }
  return ok({ ...core(record), status: "pending" });
}

/** Stop a document that was never sent, or one that failed or needs review with nothing owed. */
export function cancel(record: DocumentRecord): Result<DocumentRecord, LifecycleCode> {
  if (record.status === "pending" || record.status === "failed") {
    return ok({ ...core(record), status: "cancelled" });
  }
  if (record.status === "needs_review" && record.lookup === "clear" && record.issued === null) {
    return ok({ ...core(record), status: "cancelled" });
  }
  if (record.status === "needs_review" || record.status === "unknown") {
    return refuse("lookup_required", "it may exist in the provider; look it up first");
  }
  return wrongState("cancel", record.status);
}

const KINDS: readonly string[] = ["invoice", "payment", "credit_note", "bill", "contact"];

function str(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function parseIssued(value: unknown): IssuedDocument | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (!str(v.number) || !str(v.providerId)) return null;
  if (v.pdfRef !== null && typeof v.pdfRef !== "string") return null;
  return { number: v.number, providerId: v.providerId, pdfRef: v.pdfRef };
}

function parseMismatch(value: unknown): TotalsMismatch | null | undefined {
  if (value === null) return null;
  if (typeof value !== "object" || value === undefined) return undefined;
  const v = value as Record<string, unknown>;
  const fields = ["netPence", "vatPence", "grossPence"];
  if (!fields.includes(v.field as string) || !Number.isSafeInteger(v.differencePence)) {
    return undefined;
  }
  return { field: v.field as keyof Totals, differencePence: v.differencePence as number };
}

/**
 * Read a stored row back into a record, only in a legal state. Anything else (a status with the
 * wrong fields, an unknown with no settle time, a needs_review that says nothing about its
 * lookup) is refused instead of being trusted. Storage layers must go through this, passing the current time: the reference must belong to the
 * record's kind, and a lease or settle time beyond what a lease can grant is refused.
 */
export function parseRecord(row: unknown, nowMs: number): Result<DocumentRecord, "bad_record"> {
  const bad = (why: string) => refuse("bad_record", why);
  if (!isTime(nowMs)) return bad("parsing needs the current time");
  const leaseLimit = nowMs + MAX_LEASE_MS;
  const settleLimit = leaseLimit + SETTLE_GRACE_MS;
  if (typeof row !== "object" || row === null) return bad("not an object");
  const r = row as Record<string, unknown>;
  if (typeof r.kind !== "string" || !KINDS.includes(r.kind)) return bad("unknown kind");
  const ref = parseLaxReference(r.reference as string);
  if (!ref.ok || ref.value.kind !== r.kind) return bad("reference does not belong to this kind");
  if (!Number.isSafeInteger(r.attempts) || (r.attempts as number) < 0) return bad("bad attempts");
  const c: Core = {
    kind: r.kind as DocumentKind,
    reference: r.reference as string,
    attempts: r.attempts as number,
  };
  switch (r.status) {
    case "pending":
    case "cancelled":
      return ok({ ...c, status: r.status });
    case "sending": {
      const l = r.lease as Record<string, unknown> | null;
      if (typeof l !== "object" || l === null || !str(l.token) || !isTime(l.expiresAtMs)) {
        return bad("sending needs a lease");
      }
      if (l.expiresAtMs > leaseLimit) {
        return bad("lease runs further ahead than a lease can");
      }
      return ok({ ...c, status: "sending", lease: { token: l.token, expiresAtMs: l.expiresAtMs } });
    }
    case "issued": {
      const issued = parseIssued(r.issued);
      return issued ? ok({ ...c, status: "issued", issued }) : bad("issued needs the document");
    }
    case "unknown":
      return isTime(r.settlesAtMs) && r.settlesAtMs <= settleLimit
        ? ok({ ...c, status: "unknown", settlesAtMs: r.settlesAtMs })
        : bad("unknown needs a settle time");
    case "failed":
      return str(r.reason) ? ok({ ...c, status: "failed", reason: r.reason }) : bad("no reason");
    case "needs_review": {
      if (!str(r.reason)) return bad("no reason");
      if (r.lookup === "owed") {
        return isTime(r.settlesAtMs) && r.settlesAtMs <= settleLimit
          ? ok({
              ...c,
              status: "needs_review",
              lookup: "owed",
              settlesAtMs: r.settlesAtMs,
              reason: r.reason,
            })
          : bad("owed lookup needs a settle time");
      }
      if (r.lookup !== "clear") return bad("needs_review must say whether a lookup is owed");
      const issued = r.issued === null ? null : parseIssued(r.issued);
      const mismatch = parseMismatch(r.mismatch ?? null);
      if (r.issued !== null && issued === null) return bad("bad issued document");
      if (mismatch === undefined) return bad("bad mismatch");
      if (mismatch !== null && issued === null) return bad("a mismatch needs the document");
      return ok({
        ...c,
        status: "needs_review",
        lookup: "clear",
        reason: r.reason,
        issued,
        mismatch,
      });
    }
    default:
      return bad("unknown status");
  }
}
