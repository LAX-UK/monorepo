import type { AccountingDocument } from "./document.js";
import type { ParkReason } from "./parking.js";
import { type Projection, parkReasonFor } from "./projection/projection.js";
import { type Result, ok, refuse } from "./result.js";

export type ReleaseCode =
  /** The stored rows still park it: the reason is not settled. */
  | "unresolved"
  /** The stored rows no longer make this document (the group or payment changed). */
  | "not_rebuilt"
  /** Rebuilt from the stored rows it is not the document that was parked; a person must look. */
  | "document_changed";

/** What may be queued once a parked document is released: the document, and whether it changed. */
export interface ReleasedDocument {
  readonly document: AccountingDocument;
  /** True when the stored draft is replaced by the rebuilt document (a delivery invoice). */
  readonly rebuilt: boolean;
}

/**
 * Whether a parked document's reason is settled, decided from a fresh projection of its stored rows
 * (the same policy that parked it, run again now). Released only when that projection makes the
 * same reference and no longer parks it:
 * - `vat_on_delivery`, a delivery invoice: settled once `DELIVERY_BOOKING` is set. The draft is
 *   replaced by the invoice rebuilt with the booking; what was charged (its gross) must not move,
 *   since the payment is applied to it to the penny.
 * - `vat_on_delivery`, the "Pay several" payment with it: settled with the booking. It must come
 *   out exactly as stored.
 * - `invoice_cancelled`, a payment: settled once the invoice is no longer voided. It must come out
 *   exactly as stored.
 * - `vat_on_outside_uk_delivery`, a Shop delivery invoice: settled once
 *   `SHOP_OUTSIDE_UK_DELIVERY_BOOKING` is set. Like a Bid delivery invoice, the draft is replaced by
 *   the invoice rebuilt with the booking, for the same gross: the order's payment leaves exactly
 *   that much unapplied, and it is applied to this invoice once it is issued.
 * Anything else is refused, and nothing changes.
 */
export function resolveParked(
  parked: { readonly document: AccountingDocument; readonly reason: ParkReason },
  rebuilt: Projection,
): Result<ReleasedDocument, ReleaseCode> {
  const { document, reason } = parked;
  const fresh = rebuilt.documents.find((d) => d.reference === document.reference);
  if (!fresh) {
    return refuse("not_rebuilt", "the stored rows no longer make this document");
  }
  const still = parkReasonFor(rebuilt, document.reference);
  if (still !== null) {
    return refuse("unresolved", `still parked: ${still}`);
  }
  if (sameDocument(fresh, document)) return ok({ document, rebuilt: false });
  const redraftable =
    REDRAFTED_ON_RELEASE.has(reason) &&
    document.kind === "invoice" &&
    fresh.kind === "invoice" &&
    fresh.totals.grossPence === document.totals.grossPence;
  if (!redraftable) {
    return refuse(
      "document_changed",
      "rebuilt from the stored rows it differs from the parked one",
    );
  }
  return ok({ document: fresh, rebuilt: true });
}

/** Reasons whose parked draft is replaced on release by the invoice rebuilt with the booking. */
const REDRAFTED_ON_RELEASE: ReadonlySet<ParkReason> = new Set([
  "vat_on_delivery",
  "vat_on_outside_uk_delivery",
]);

/** Two documents say the same thing: equal plain data, whatever the order of their keys. */
export function sameDocument(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => sameDocument(value, b[i]));
  }
  const ak = Object.keys(a as object).filter(
    (k) => (a as Record<string, unknown>)[k] !== undefined,
  );
  const bk = Object.keys(b as object).filter(
    (k) => (b as Record<string, unknown>)[k] !== undefined,
  );
  return (
    ak.length === bk.length &&
    ak.every((k) =>
      sameDocument((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  );
}
