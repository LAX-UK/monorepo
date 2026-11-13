import type { AccountingDocument, DocumentCode, DocumentKind } from "../document.js";
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
}

export const EMPTY_PROJECTION: Projection = { documents: [] };

export type ProjectionCode =
  | DocumentCode
  /** An invoice line of a kind no mapping says how to book yet (VAT treatment and role). */
  | "unmapped_line"
  /** An invoice line of a kind waiting for the accountant to say how it is booked (ARR, say). */
  | "line_awaiting_accountant"
  /** A payment larger than what its invoices still owe: a remainder is never spread. */
  | "payment_exceeds_invoice"
  /** The facts handed in do not describe a possible state (an id that is not a source id, say). */
  | "bad_facts";

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
