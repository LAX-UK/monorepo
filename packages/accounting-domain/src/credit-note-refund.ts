import type { AccountingDocument, LegalEntity, Product } from "./document.js";
import type { Pence } from "./money.js";
import type { WriteFence } from "./ports.js";
import { type Result, ok, refuse } from "./result.js";

/**
 * Giving a credit note's money back: once a credit note for a refund that went through is issued,
 * its whole gross is refunded from the Stripe clearing account in the same books (Books' "refund"
 * on the credit note), once. Keyed by the credit note's LAX reference: one credit note is refunded
 * once, and doing it again is recognised, never a second refund.
 */
export interface CreditNoteRefund {
  readonly product: Product;
  readonly entity: LegalEntity;
  /** The credit note refunded (its LAX reference); also this refund's own key. */
  readonly creditNoteReference: string;
  readonly contactReference: string;
  /** The credit note's gross: exactly what went back to the buyer. */
  readonly amountPence: Pence;
  readonly refundedOn: string;
  readonly account: "stripe_clearing";
}

export type CreditNoteRefundCode =
  /** Not a credit note. */
  | "not_a_credit_note"
  /** A credit note that gives no money back (a cancellation): nothing to refund. */
  | "no_money_back";

/**
 * The refund of `creditNote`, checked from the stored document alone. Only a credit note that says
 * money went back (`refund`) is refunded, and always for its whole gross.
 */
export function planCreditNoteRefund(
  creditNote: AccountingDocument,
): Result<CreditNoteRefund, CreditNoteRefundCode> {
  if (creditNote.kind !== "credit_note") {
    return refuse("not_a_credit_note", "only a credit note is refunded");
  }
  if (!creditNote.refund) {
    return refuse("no_money_back", "this credit note gives no money back");
  }
  return ok({
    product: creditNote.product,
    entity: creditNote.entity,
    creditNoteReference: creditNote.reference,
    contactReference: creditNote.contactReference,
    amountPence: creditNote.totals.grossPence,
    refundedOn: creditNote.refund.refundedOn,
    account: creditNote.refund.account,
  });
}

/**
 * What refunding a credit note ended in:
 * - `refunded`: the provider recorded the refund now;
 * - `already_refunded`: the provider already shows exactly this refund on the credit note (an
 *   earlier run did it, or its answer was lost): nothing was sent again;
 * - `rejected`: refused, nothing refunded; a person decides;
 * - `unknown`: we cannot tell; it is looked at again on the next run (the check comes first).
 */
export type CreditNoteRefundOutcome =
  | { readonly status: "refunded" | "already_refunded"; readonly rehearsal: boolean }
  | { readonly status: "rejected"; readonly reason: string }
  | { readonly status: "unknown"; readonly detail?: string };

export interface CreditNoteRefundPort {
  refundCreditNote(refund: CreditNoteRefund, fence?: WriteFence): Promise<CreditNoteRefundOutcome>;
}
