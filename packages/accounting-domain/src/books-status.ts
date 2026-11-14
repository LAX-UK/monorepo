import type { AccountingDocument, DocumentKind } from "./document.js";
import type { IssuedDocument } from "./ports.js";

/**
 * The nightly status check: LAX reads back, from the provider, the documents it issued there and
 * records what staff changed by hand in the books since (a document voided, a payment recorded
 * there for a gallery sale or a cheque). The provider is never trusted to move money in LAX:
 * nothing here can mark an invoice or a lot paid. A payment recorded only in the books becomes a
 * finance task, and a person decides.
 */

/** Kinds whose state the check reads back: what a buyer owes, is owed, or paid. */
export const STATUS_CHECKED_KINDS = [
  "invoice",
  "credit_note",
  "payment",
] as const satisfies readonly DocumentKind[];
export type StatusCheckedKind = (typeof STATUS_CHECKED_KINDS)[number];

export function isStatusCheckedKind(kind: DocumentKind): kind is StatusCheckedKind {
  return (STATUS_CHECKED_KINDS as readonly string[]).includes(kind);
}

/**
 * What the provider says a document is now, in LAX's words. `other` is any state the adapter does
 * not know: it is recorded as read, never guessed at.
 */
export const BOOKS_STATES = [
  "draft",
  "open",
  "overdue",
  "partially_paid",
  "paid",
  /** A credit note fully used (applied or refunded). */
  "closed",
  /** A payment the provider still holds; payments have no other state. */
  "recorded",
  "void",
  "other",
] as const;
export type BooksState = (typeof BOOKS_STATES)[number];

export function isBooksState(value: unknown): value is BooksState {
  return typeof value === "string" && (BOOKS_STATES as readonly string[]).includes(value);
}

/** A payment the provider shows against an invoice, as it shows it. Never applied to anything in LAX. */
export interface BooksPaymentSeen {
  /** The provider's own payment id. */
  readonly providerPaymentId: string;
  readonly amountPence: number;
  /** The payment date as the provider holds it (YYYY-MM-DD), when it gives one. */
  readonly date: string | null;
  /** How it was paid, as the provider words it (e.g. "Cheque"); free text, shown to finance only. */
  readonly mode: string | null;
  /** The reference the payment carries in the provider (LAX sends its own), when it has one. */
  readonly reference: string | null;
}

/** One read of a document's state from the provider. */
export interface BooksStatusReading {
  readonly state: BooksState;
  /** What is still owed, for an invoice; null for other kinds or when the provider gives none. */
  readonly balancePence: number | null;
  /** Payments the provider shows against an invoice; empty for other kinds. */
  readonly payments: readonly BooksPaymentSeen[];
}

/**
 * What a status read can end in. `rehearsal` is the dry run's answer: nothing was asked and
 * nothing is known, so nothing is recorded. `budget_spent` means the day's share of calls for the
 * check is used up: the check stops and the rest waits for the next night.
 */
export type StatusReadOutcome =
  | { readonly status: "read"; readonly reading: BooksStatusReading }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "budget_spent" }
  | { readonly status: "rehearsal" };

/** Reads one issued document's state from the provider. Read only: it never writes anything. */
export interface DocumentStatusPort {
  readStatus(document: AccountingDocument, issued: IssuedDocument): Promise<StatusReadOutcome>;
}

/**
 * Where status readers come from: each one spends at most its own share of the provider's daily
 * calls, counted for as long as it lives, and answers `budget_spent` once the share is used. Build
 * one for each run (or each day of notice reads), never one for the life of the process.
 */
export interface DocumentStatusReaders {
  withinShare(allowance: StatusCheckAllowance): DocumentStatusPort;
}

/** What LAX last recorded of a document's state in the provider. */
export interface BooksStatusSnapshot {
  readonly state: BooksState | "missing";
  readonly balancePence: number | null;
  /** Every provider payment id seen against it so far, sorted. */
  readonly paymentIds: readonly string[];
}

/** One thing that changed in the provider since the last read. */
export type BooksStatusChange =
  | {
      readonly kind: "state_changed";
      readonly from: BooksStatusSnapshot["state"] | null;
      readonly to: BooksStatusSnapshot["state"];
    }
  /** A payment the provider shows that LAX did not send: someone recorded it in the books. */
  | { readonly kind: "payment_recorded_in_books"; readonly payment: BooksPaymentSeen };

/**
 * What the check does with one read: the snapshot to keep, the changes to record, and the payments
 * that need a finance task. Deliberately nothing else: there is no way to say "mark paid".
 */
export interface BooksStatusDecision {
  readonly snapshot: BooksStatusSnapshot;
  readonly changes: readonly BooksStatusChange[];
  /** Payments recorded in the books by hand, each to become one finance task (never applied). */
  readonly financeTasks: readonly BooksPaymentSeen[];
  /**
   * Payments not told apart yet, because a LAX payment on the invoice is not settled: no task, and
   * left out of the snapshot, so the next read looks at them again.
   */
  readonly heldBack: readonly BooksPaymentSeen[];
}

/** What LAX holds of its own payments in the books a document is in. */
export interface LaxPaymentsInBooks {
  /** Provider ids of LAX's payment documents in these books, whatever state the document is in. */
  readonly providerIds: ReadonlySet<string>;
  /**
   * LAX references of its payment documents applied to the invoice that hold no provider id yet
   * (the send's outcome is not known): a provider payment carrying one of them is LAX's own.
   */
  readonly referencesWithoutProviderId: ReadonlySet<string>;
  /**
   * True while any LAX payment document applied to the invoice is not settled (neither issued nor
   * cancelled): LAX may have sent it without knowing its provider id.
   */
  readonly unresolved: boolean;
}

export const NO_LAX_PAYMENTS: LaxPaymentsInBooks = {
  providerIds: new Set(),
  referencesWithoutProviderId: new Set(),
  unresolved: false,
};

function isLaxPayment(payment: BooksPaymentSeen, lax: LaxPaymentsInBooks): boolean {
  if (lax.providerIds.has(payment.providerPaymentId)) return true;
  return payment.reference !== null && lax.referencesWithoutProviderId.has(payment.reference);
}

/**
 * Compares a read with what LAX last recorded. A payment is LAX's own when its provider id belongs
 * to a LAX payment document in any state, or it carries the reference of a LAX payment whose
 * provider id LAX never learnt. Any other is a payment recorded in the books by a person, reported
 * once, the first time it is seen, but only while every LAX payment on the invoice is settled:
 * until then it may be LAX's own, so it is held back and read again. The very first read of a
 * document records its state as a change from nothing, so the history says when the check first
 * looked.
 */
export function decideBooksStatus(input: {
  readonly previous: BooksStatusSnapshot | null;
  readonly read:
    | { readonly status: "read"; readonly reading: BooksStatusReading }
    | { readonly status: "not_found" };
  readonly laxPayments: LaxPaymentsInBooks;
}): BooksStatusDecision {
  const { previous, read, laxPayments } = input;
  const state: BooksStatusSnapshot["state"] =
    read.status === "read" ? read.reading.state : "missing";
  const payments = read.status === "read" ? read.reading.payments : [];
  const seen = new Set(previous?.paymentIds ?? []);

  const changes: BooksStatusChange[] = [];
  if (!previous || previous.state !== state) {
    changes.push({ kind: "state_changed", from: previous?.state ?? null, to: state });
  }
  const financeTasks: BooksPaymentSeen[] = [];
  const heldBack: BooksPaymentSeen[] = [];
  const kept = new Set(seen);
  for (const payment of payments) {
    if (seen.has(payment.providerPaymentId)) continue;
    if (isLaxPayment(payment, laxPayments)) {
      kept.add(payment.providerPaymentId);
      continue;
    }
    if (laxPayments.unresolved) {
      heldBack.push(payment);
      continue;
    }
    kept.add(payment.providerPaymentId);
    changes.push({ kind: "payment_recorded_in_books", payment });
    financeTasks.push(payment);
  }

  return {
    snapshot: {
      state,
      balancePence: read.status === "read" ? read.reading.balancePence : null,
      paymentIds: [...kept].sort(),
    },
    changes,
    financeTasks,
    heldBack,
  };
}

/**
 * A share of the provider's daily call budget, so sending documents is never starved by the status
 * check: a reader within it stops after `maxCalls` of its own, and before the day's count leaves
 * fewer than `keepFree` calls for everything else.
 */
export interface StatusCheckAllowance {
  readonly maxCalls: number;
  readonly keepFree: number;
}

/** The nightly run's share, built afresh for each run. */
export const DEFAULT_STATUS_CHECK_ALLOWANCE: StatusCheckAllowance = {
  maxCalls: 300,
  keepFree: 400,
};

/**
 * The share for reads a Books notice asks for, built afresh each UTC day and separate from the
 * night's: notices can never spend more than this in a day, however many arrive.
 */
export const DEFAULT_NOTICE_READ_ALLOWANCE: StatusCheckAllowance = {
  maxCalls: 50,
  keepFree: 400,
};

/**
 * The finance task's key for a payment recorded in the books: one task per provider payment and
 * LAX invoice it is applied to. One cheque split across two invoices is two tasks, each for the
 * part Books applied to that invoice, so finance sees every part.
 */
export function booksPaymentTaskReference(
  organisationId: string,
  providerPaymentId: string,
  invoiceReference: string,
): string {
  return `books:${organisationId}:${providerPaymentId}:${invoiceReference}`;
}
