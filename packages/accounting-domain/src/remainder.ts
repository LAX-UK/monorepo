import type { AccountingDocument, LegalEntity, Product } from "./document.js";
import type { Pence } from "./money.js";
import type { WriteFence } from "./ports.js";
import { type Result, ok, refuse } from "./result.js";

/**
 * Applying what a payment left unapplied to an invoice issued after it. A Shop order's payment is
 * booked when the order is paid, applied to the goods invoice only: an outside-UK delivery waits
 * for the accountant, so its part stays on the buyer's account as unapplied credit. Once the
 * delivery invoice is released and issued, that credit is applied to it, once.
 *
 * It is keyed by the invoice's LAX reference: one invoice is paid from one payment's remainder,
 * and doing it again is recognised, never a second application.
 */
export interface RemainderApplication {
  readonly product: Product;
  readonly entity: LegalEntity;
  /** The payment whose unapplied rest is used (its LAX reference). */
  readonly paymentReference: string;
  /** The invoice it is applied to (its LAX reference); also this application's own key. */
  readonly invoiceReference: string;
  readonly contactReference: string;
  /** The invoice's gross: exactly what the payment left unapplied for it. */
  readonly amountPence: Pence;
}

export type RemainderCode =
  /** The two documents are not a payment and an invoice of the same books and buyer. */
  | "not_paired"
  /** The payment already applies to this invoice when it was sent: there is no remainder step. */
  | "already_allocated"
  /** The invoice's gross is more than the payment left unapplied. */
  | "exceeds_remainder";

/**
 * The application of `payment`'s unapplied rest to `invoice`, checked from the stored documents
 * alone: same product, legal entity and buyer contact; the invoice is not one the payment was
 * already applied to; and its gross fits in what the payment left unapplied. Anything else is
 * refused, and nothing is asked of the books.
 */
export function planRemainder(
  payment: AccountingDocument,
  invoice: AccountingDocument,
): Result<RemainderApplication, RemainderCode> {
  if (
    payment.kind !== "payment" ||
    invoice.kind !== "invoice" ||
    payment.product !== invoice.product ||
    payment.entity !== invoice.entity ||
    payment.contactReference !== invoice.contactReference
  ) {
    return refuse("not_paired", "not a payment and an invoice of the same books and buyer");
  }
  if (payment.allocations.some((a) => a.invoiceReference === invoice.reference)) {
    return refuse("already_allocated", "the payment was sent applied to this invoice");
  }
  const amountPence = invoice.totals.grossPence;
  if (amountPence <= 0 || amountPence > payment.unallocatedPence) {
    return refuse(
      "exceeds_remainder",
      `the invoice's ${amountPence}p is not within the payment's unapplied ${payment.unallocatedPence}p`,
    );
  }
  return ok({
    product: payment.product,
    entity: payment.entity,
    paymentReference: payment.reference,
    invoiceReference: invoice.reference,
    contactReference: payment.contactReference,
    amountPence,
  });
}

/**
 * What applying a remainder ended in:
 * - `applied`: the provider applied it now;
 * - `already_applied`: the provider already shows the payment applied to the invoice (an earlier
 *   run did it, or its answer was lost): nothing was sent again;
 * - `rejected`: refused, nothing applied; a person decides;
 * - `unknown`: we cannot tell; it is looked at again on the next run (the check comes first).
 */
export type RemainderOutcome =
  | { readonly status: "applied" | "already_applied"; readonly rehearsal: boolean }
  | { readonly status: "rejected"; readonly reason: string }
  | { readonly status: "unknown"; readonly detail?: string };

export interface PaymentRemainderPort {
  applyRemainder(application: RemainderApplication, fence?: WriteFence): Promise<RemainderOutcome>;
}
