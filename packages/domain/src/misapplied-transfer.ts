/**
 * A bank transfer carries the payment reference of the invoice it was sent for. The payment
 * provider can still apply the money to another open payment of the same buyer (for instance when
 * the invoice it was sent for had been closed). Nothing is lost, but the money is then recorded
 * against the wrong invoice, so finance is told. These rules decide when that has happened.
 */

/** One entry of a buyer's transfer ledger, reduced to what finding the source of money needs. */
export type LedgerEntry =
  | { kind: "funded"; id: string; reference: string | null }
  | { kind: "unapplied"; id: string; paymentIntentId: string }
  /** The money left the balance (refunded, moved to the account balance, a return): the trail ends. */
  | { kind: "stop"; id: string }
  | { kind: "other"; id: string };

/** Where the money applied to a payment came from. */
export type TransferSupply =
  | { kind: "funded"; reference: string | null }
  | { kind: "unapplied"; paymentIntentId: string }
  | { kind: "stopped" };

/**
 * The source of an application: the first transfer received, or the first payment the money was
 * taken back from, found walking back from the application (entries newest first, as the ledger
 * lists them). Other applications in between are skipped. Order, not timestamps, decides: several
 * entries can share one second.
 */
export function supplyBehindApplication(
  entriesNewestFirst: readonly LedgerEntry[],
): TransferSupply | null {
  for (const entry of entriesNewestFirst) {
    if (entry.kind === "stop") return { kind: "stopped" };
    if (entry.kind === "funded") return { kind: "funded", reference: entry.reference };
    if (entry.kind === "unapplied") {
      return { kind: "unapplied", paymentIntentId: entry.paymentIntentId };
    }
  }
  return null;
}

/** A reference compared as letters and digits only, in one case: senders add spaces and dashes. */
export function normaliseReference(reference: string): string {
  return reference.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

/** Whether what the sender typed contains the reference (banks add their own text around it). */
export function senderQuotedReference(sent: string, reference: string): boolean {
  const wanted = normaliseReference(reference);
  return wanted.length > 0 && normaliseReference(sent).includes(wanted);
}

/**
 * Whether money was applied to a payment other than the one whose reference the sender used.
 * Both references must be known: with either missing nothing can be said, so it is not a mismatch.
 */
export function isTransferAppliedToOtherPayment(input: {
  sentWithReference: string | null;
  paymentOwnReference: string | null;
}): boolean {
  const { sentWithReference: sent, paymentOwnReference: own } = input;
  if (!sent?.trim() || !own?.trim()) return false;
  return !senderQuotedReference(sent, own);
}

/**
 * The kept reference the sender quoted, when it is one we issued: the longest that the sent text
 * contains. Text that contains none of ours is not another invoice's reference.
 */
export function referenceIssuedIn<T extends { reference: string }>(
  sent: string,
  issued: readonly T[],
): T | null {
  let best: T | null = null;
  for (const candidate of issued) {
    if (!senderQuotedReference(sent, candidate.reference)) continue;
    if (
      !best ||
      normaliseReference(candidate.reference).length > normaliseReference(best.reference).length
    ) {
      best = candidate;
    }
  }
  return best;
}

type PaymentIdentity = {
  paymentId: string | null;
  paymentGroupId: string | null;
  privateSaleDealPaymentId: string | null;
  /** The invoices a combined payment holds or held (empty for a single invoice). */
  memberPaymentIds: readonly string[];
};

/**
 * Whether two payments are one invoice's money: the same payment, the same private sale deal
 * payment, the same combined payment, an invoice and a combined payment that holds it, or two
 * combined payments that share an invoice (one let go, one opened after it).
 */
export function isSameInvoiceMoney(a: PaymentIdentity, b: PaymentIdentity): boolean {
  if (a.paymentId && a.paymentId === b.paymentId) return true;
  if (a.privateSaleDealPaymentId && a.privateSaleDealPaymentId === b.privateSaleDealPaymentId) {
    return true;
  }
  if (a.paymentGroupId && a.paymentGroupId === b.paymentGroupId) return true;
  if (a.paymentId && b.memberPaymentIds.includes(a.paymentId)) return true;
  if (b.paymentId && a.memberPaymentIds.includes(b.paymentId)) return true;
  return a.memberPaymentIds.some((id) => b.memberPaymentIds.includes(id));
}
