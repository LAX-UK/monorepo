import type { AccountingDocument, DocumentCode, DocumentKind } from "../document.js";
import type { ParkReason } from "../parking.js";
import type { Result } from "../result.js";

/**
 * What one business event means for the books: the documents it gives, in the order they must
 * be registered (a contact before the invoice that names it, an invoice before the payment or
 * credit note that refers to it). Every document carries a reference derived from the LAX row it
 * comes from, so projecting the same facts again gives the same documents, and registering them
 * again is a replay, never a second document.
 */
export interface Projection {
  readonly documents: readonly AccountingDocument[];
  /**
   * Documents among `documents` that are stored parked, not queued: built and kept so a person
   * sees them in "Needs a person", but never sent until the reason is settled. Absent or empty
   * when every document is queued.
   */
  readonly parked?: readonly ParkedDocument[];
  /**
   * LAX references of documents already registered in the same books that this event makes owed
   * no more (an invoice cancelled after a buyer default before Books issued it). The runtime
   * cancels each one that was never sent; one being sent, or one whose outcome is unknown, is
   * looked at again later, and one issued meanwhile is credited instead. Absent when none.
   */
  readonly cancel?: readonly string[];
  /**
   * LAX references of documents already issued in the same books that this event says can no
   * longer simply stand (a credit note whose refund was taken back): each is held for a person
   * with the provider's document kept (`hold`), and an alert is raised. Nothing is undone in the
   * books automatically. Absent when none.
   */
  readonly hold?: readonly HeldDocument[];
}

/** Why an issued document is held for a person. */
export const HOLD_REASONS = [
  /** The refund the credit note was for was taken back (it failed) after the note was issued. */
  "refund_reversed_after_credit",
] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];

/** The reason stored on a held document, e.g. `accounting_refund_reversed_after_credit`. */
export function heldReasonCode(reason: HoldReason): string {
  return `accounting_${reason}`;
}

/** One issued document a projection holds for a person, and why. */
export interface HeldDocument {
  readonly reference: string;
  readonly reason: HoldReason;
}

/** One of a projection's documents that is stored parked, and why. */
export interface ParkedDocument {
  readonly reference: string;
  readonly reason: ParkReason;
}

export const EMPTY_PROJECTION: Projection = { documents: [] };

/** Why this projection parks the document with `reference`, or null when it is queued. */
export function parkReasonFor(projection: Projection, reference: string): ParkReason | null {
  return projection.parked?.find((p) => p.reference === reference)?.reason ?? null;
}

export type ProjectionCode =
  | DocumentCode
  /** An invoice line of a kind no mapping says how to book yet (VAT treatment and role). */
  | "unmapped_line"
  /** An invoice line of a kind waiting for the accountant to say how it is booked (ARR, say). */
  | "line_awaiting_accountant"
  /** A payment larger than what its invoices still owe: a remainder is never spread. */
  | "payment_exceeds_invoice"
  /** A payment whose allocations do not add up to exactly what was paid, to the penny. */
  | "allocation_mismatch"
  /** Money in a currency other than pounds: the books are kept in GBP only. */
  | "not_in_pounds"
  /** A combined payment naming an invoice raised to another buyer account. */
  | "buyer_mismatch"
  /** The facts handed in do not describe a possible state (an id that is not a source id, say). */
  | "bad_facts"
  /**
   * The invoice a buyer default cancels is being sent to the books, or its outcome is not known
   * yet: whether it is cancelled or credited is decided once it settles (the event is tried again).
   */
  | "invoice_in_flight"
  /** The invoice is in the books but held for a person (a totals difference): a person decides. */
  | "invoice_held_for_review"
  /**
   * A credit note this event cancels or holds is being sent to the books, or its outcome is not
   * known yet: decided once it settles (the event is tried again).
   */
  | "credit_in_flight"
  /**
   * A Shop refund whose credit cannot be placed on the invoice's lines with certainty (a part of
   * an order with several lines, naming none): it waits for staff, never guessed.
   */
  | "refund_unattributed";

/** A pure projection policy: one per flow, facts in, documents out. No I/O, no clock. */
export type ProjectionPolicy<F> = (facts: F) => Result<Projection, ProjectionCode>;

/**
 * What the runtime does when a document's reference is already registered with other details.
 * A contact is an "ensure": the one already held stands (its details are brought up to date by a
 * contact flow of its own, never by re-registering). Every other kind must match exactly: the
 * same reference with a different amount is a fault to investigate, never overwritten.
 */
export type WhenReferenceHeld = "keep_held" | "must_match";

export function whenReferenceHeld(kind: DocumentKind): WhenReferenceHeld {
  return kind === "contact" ? "keep_held" : "must_match";
}
