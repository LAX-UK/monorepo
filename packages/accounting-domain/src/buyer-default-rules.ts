import { type Pence, isPence } from "./money.js";
import { type Result, ok, refuse } from "./result.js";

/**
 * The owner's accounting rules for buyer defaults and refunds (decided 2026-11-19), as pure checks.
 * Nothing here reads or writes: callers load the facts, ask, and act on the answer. See
 * docs/design/buyer-default-and-refunds.md for where each rule is wired and what still waits.
 *
 * 1. A sent invoice is always cancelled by a credit note, never voided. Void is only for an
 *    invoice raised in error and never sent to the buyer.
 * 2. A payment that arrives after the credit note leaves the credit note in place: a new invoice
 *    is raised for the same lot and the payment is applied to it.
 * 3. A bank-transfer refund goes only to the account the money came from. A Stripe bank-transfer
 *    payment is refunded through Stripe; a direct bank payment needs a staff request and the
 *    approval of a second, different staff member, and is then recorded in the books against the
 *    credit note.
 */

// ---------------------------------------------------------------------------------------------
// Rule 1: credit note, not void, once an invoice was sent
// ---------------------------------------------------------------------------------------------

export interface InvoiceCancellationFacts {
  /** The buyer was given the invoice (email, purchase page, PDF, or the books sent it). */
  readonly sentToBuyer: boolean;
  /** Staff say the invoice should never have been raised (wrong buyer, wrong lot, duplicate). */
  readonly raisedInError: boolean;
}

export type InvoiceCancellation = "void" | "credit_note";

export type VoidCode =
  /** The buyer has seen the invoice: it is credited, never voided. */
  | "invoice_sent"
  /** Not sent, but not raised in error either (a buyer default, say): it is credited. */
  | "not_raised_in_error";

/** Whether this invoice may be voided. Refused unless it was raised in error and never sent. */
export function checkVoid(facts: InvoiceCancellationFacts): Result<"void", VoidCode> {
  if (facts.sentToBuyer) {
    return refuse("invoice_sent", "the buyer has this invoice: cancel it with a credit note");
  }
  if (!facts.raisedInError) {
    return refuse("not_raised_in_error", "only an invoice raised in error may be voided");
  }
  return ok("void");
}

/** How an invoice is cancelled: void only where `checkVoid` allows it, a credit note otherwise. */
export function cancellationOf(facts: InvoiceCancellationFacts): InvoiceCancellation {
  return checkVoid(facts).ok ? "void" : "credit_note";
}

// ---------------------------------------------------------------------------------------------
// Rule 2: a payment after the credit note is applied to a new invoice for the same lot
// ---------------------------------------------------------------------------------------------

export interface CreditedInvoice {
  readonly invoiceId: string;
  readonly lotId: string;
  readonly buyerLegalEntityId: string;
  readonly totalPence: Pence;
  /** The credit note that cancelled it (its LAX reference); null when it was not credited. */
  readonly creditNoteReference: string | null;
}

export interface LatePayment {
  readonly paymentId: string;
  /** The buyer account the money came from. */
  readonly payerLegalEntityId: string;
  readonly amountPence: Pence;
}

export interface ReinvoicePlan {
  /** Never cancelled, reversed or edited: it stays in the books as it is. */
  readonly creditNoteStays: string;
  readonly newInvoice: {
    readonly lotId: string;
    readonly buyerLegalEntityId: string;
    /** The same total as the credited invoice: the same lot, sold on the same terms. */
    readonly totalPence: Pence;
    /** The invoice it follows, for the audit trail and the buyer's purchase page. */
    readonly followsInvoiceId: string;
    /** One new invoice per credited invoice and payment, however often this is asked. */
    readonly idempotencyKey: string;
  };
  readonly allocation: { readonly paymentId: string; readonly amountPence: Pence };
}

export type ReinvoiceCode =
  | "bad_amount"
  /** The invoice was not cancelled by a credit note: the payment is applied to it as usual. */
  | "invoice_not_credited"
  /** The money came from another buyer account: it is refunded, never applied to this lot. */
  | "payer_mismatch"
  /** More than the invoice: the rest would sit unexplained; refund the difference first. */
  | "overpaid";

/**
 * A payment for an invoice already cancelled by a credit note. The credit note stays; a new
 * invoice is raised for the same lot and buyer account, and the payment is applied to it. A part
 * payment is applied as it is (the new invoice stays part paid).
 */
export function planReinvoiceAfterCreditNote(
  invoice: CreditedInvoice,
  payment: LatePayment,
): Result<ReinvoicePlan, ReinvoiceCode> {
  if (!isPence(invoice.totalPence) || invoice.totalPence <= 0) {
    return refuse("bad_amount", "the invoice total must be positive whole pence");
  }
  if (!isPence(payment.amountPence) || payment.amountPence <= 0) {
    return refuse("bad_amount", "the payment must be positive whole pence");
  }
  if (invoice.creditNoteReference === null) {
    return refuse("invoice_not_credited", "the invoice stands: apply the payment to it");
  }
  if (payment.payerLegalEntityId !== invoice.buyerLegalEntityId) {
    return refuse("payer_mismatch", "the money came from another buyer account");
  }
  if (payment.amountPence > invoice.totalPence) {
    return refuse("overpaid", "the payment is more than the invoice");
  }
  return ok({
    creditNoteStays: invoice.creditNoteReference,
    newInvoice: {
      lotId: invoice.lotId,
      buyerLegalEntityId: invoice.buyerLegalEntityId,
      totalPence: invoice.totalPence,
      followsInvoiceId: invoice.invoiceId,
      idempotencyKey: `reinvoice:${invoice.invoiceId}:${payment.paymentId}`,
    },
    allocation: { paymentId: payment.paymentId, amountPence: payment.amountPence },
  });
}

// ---------------------------------------------------------------------------------------------
// Rule 3: refunds go back where the money came from
// ---------------------------------------------------------------------------------------------

/** A UK bank account as it reached us: six-digit sort code, eight-digit account number. */
export interface UkBankAccount {
  readonly sortCode: string;
  readonly accountNumber: string;
}

/** Where the money for a payment came from. */
export type FundsSource =
  | { readonly rail: "card"; readonly chargeId: string }
  /**
   * A Stripe UK bank transfer (customer balance). `sender` is the account Stripe reported with
   * the transfer; null when Stripe did not report one.
   */
  | {
      readonly rail: "stripe_bank_transfer";
      readonly chargeId: string;
      readonly sender: UkBankAccount | null;
    }
  /** Paid straight into our bank account, outside Stripe. */
  | { readonly rail: "direct_bank"; readonly sender: UkBankAccount };

/** How the refund is made: always to the source, never to an account someone types in. */
export type RefundRoute =
  | {
      readonly via: "stripe";
      readonly chargeId: string;
      readonly expectedAccount: UkBankAccount | null;
    }
  | { readonly via: "direct_bank"; readonly account: UkBankAccount };

export type RefundDestinationCode =
  /** A sort code or account number that is not six or eight digits. */
  | "bad_account"
  /** The account asked for is not the one the money came from. */
  | "destination_not_source"
  /**
   * Stripe did not report the sending account, so it would ask the buyer for one by email and
   * could pay a different account. Refused: a person checks the source first.
   */
  | "source_account_unknown";

function normaliseAccount(account: UkBankAccount): UkBankAccount | null {
  const sortCode = account.sortCode.replace(/[\s-]/g, "");
  const accountNumber = account.accountNumber.replace(/\s/g, "");
  if (!/^\d{6}$/.test(sortCode) || !/^\d{8}$/.test(accountNumber)) return null;
  return { sortCode, accountNumber };
}

function sameAccount(a: UkBankAccount, b: UkBankAccount): boolean {
  return a.sortCode === b.sortCode && a.accountNumber === b.accountNumber;
}

/**
 * The only route a refund of `source` may take. A requested account, when one is given, must be
 * the source account: it can confirm the destination, never change it.
 */
export function lockRefundDestination(
  source: FundsSource,
  requested?: UkBankAccount,
): Result<RefundRoute, RefundDestinationCode> {
  const asked = requested === undefined ? undefined : normaliseAccount(requested);
  if (asked === null)
    return refuse("bad_account", "enter a six-digit sort code and eight-digit account number");
  switch (source.rail) {
    case "card":
      if (asked !== undefined) {
        return refuse("destination_not_source", "a card payment is refunded to the card");
      }
      return ok({ via: "stripe", chargeId: source.chargeId, expectedAccount: null });
    case "stripe_bank_transfer": {
      if (source.sender === null) {
        return refuse(
          "source_account_unknown",
          "Stripe did not report the account this transfer came from",
        );
      }
      const sender = normaliseAccount(source.sender);
      if (sender === null)
        return refuse("bad_account", "the sending account Stripe reported is not valid");
      if (asked !== undefined && !sameAccount(asked, sender)) {
        return refuse(
          "destination_not_source",
          "the refund goes to the account the money came from",
        );
      }
      return ok({ via: "stripe", chargeId: source.chargeId, expectedAccount: sender });
    }
    case "direct_bank": {
      const sender = normaliseAccount(source.sender);
      if (sender === null)
        return refuse("bad_account", "the sending account on record is not valid");
      if (asked !== undefined && !sameAccount(asked, sender)) {
        return refuse(
          "destination_not_source",
          "the refund goes to the account the money came from",
        );
      }
      return ok({ via: "direct_bank", account: sender });
    }
    default:
      return refuse("bad_account", "unknown payment rail");
  }
}

// ---------------------------------------------------------------------------------------------
// Rule 3: a direct bank refund is requested by one staff member and approved by another
// ---------------------------------------------------------------------------------------------

export interface RefundAuditEntry {
  readonly action: "requested" | "approved" | "recorded_in_books";
  readonly actorId: string;
  /** ISO 8601 instant; the clock is the caller's. */
  readonly at: string;
}

export type DirectBankRefund = {
  /** The request's own key: asking again with it returns this request, never a second one. */
  readonly idempotencyKey: string;
  /** The credit note the money goes back against (its LAX reference). */
  readonly creditNoteReference: string;
  readonly amountPence: Pence;
  /** Locked to the account the money came from when the request was made. */
  readonly account: UkBankAccount;
  readonly reason: string;
  readonly requestedBy: string;
  readonly audit: readonly RefundAuditEntry[];
} & (
  | { readonly status: "requested" }
  | { readonly status: "approved"; readonly approvedBy: string }
  | {
      readonly status: "recorded";
      readonly approvedBy: string;
      /** Where the books hold it: the refund on the credit note, paid from the bank account. */
      readonly books: {
        readonly creditNoteReference: string;
        readonly amountPence: Pence;
        readonly paidOn: string;
      };
    }
);

export type DirectBankRefundCode =
  | "bad_amount"
  | "bad_reason"
  | "bad_actor"
  | "not_direct_bank"
  | RefundDestinationCode
  /** More than the credit note still has to give back. */
  | "exceeds_refundable"
  /** The person who asked for the refund cannot approve it. */
  | "approver_is_requester"
  /** Approved by someone else already. */
  | "already_approved"
  /** Recorded in the books only once approved. */
  | "not_approved"
  | "bad_date";

export const DIRECT_BANK_REFUND_REASON_MIN = 10;
export const DIRECT_BANK_REFUND_REASON_MAX = 1000;

export interface DirectBankRefundRequest {
  readonly idempotencyKey: string;
  readonly creditNoteReference: string;
  /** The credit note's gross less what has already gone back against it. */
  readonly refundablePence: Pence;
  readonly amountPence: Pence;
  readonly source: FundsSource;
  /** The account staff typed in, if any: it must be the source account. */
  readonly requestedAccount?: UkBankAccount;
  readonly reason: string;
  readonly requestedBy: string;
  readonly at: string;
}

/** A staff request to refund a direct bank payment. It moves no money until approved. */
export function requestDirectBankRefund(
  input: DirectBankRefundRequest,
): Result<DirectBankRefund, DirectBankRefundCode> {
  if (input.source.rail !== "direct_bank") {
    return refuse("not_direct_bank", "a Stripe payment is refunded through Stripe");
  }
  if (!isPence(input.amountPence) || input.amountPence <= 0) {
    return refuse("bad_amount", "the refund must be positive whole pence");
  }
  if (!isPence(input.refundablePence) || input.refundablePence < 0) {
    return refuse("bad_amount", "what is refundable must be whole pence");
  }
  if (input.amountPence > input.refundablePence) {
    return refuse("exceeds_refundable", "more than the credit note has left to give back");
  }
  const reason = input.reason.trim();
  if (
    reason.length < DIRECT_BANK_REFUND_REASON_MIN ||
    reason.length > DIRECT_BANK_REFUND_REASON_MAX
  ) {
    return refuse(
      "bad_reason",
      `give a reason of ${DIRECT_BANK_REFUND_REASON_MIN} to ${DIRECT_BANK_REFUND_REASON_MAX} characters`,
    );
  }
  const requestedBy = input.requestedBy.trim();
  if (!requestedBy || !input.idempotencyKey.trim() || !input.creditNoteReference.trim()) {
    return refuse("bad_actor", "a request needs its staff member, key and credit note");
  }
  const route = lockRefundDestination(input.source, input.requestedAccount);
  if (!route.ok) return route;
  if (route.value.via !== "direct_bank") {
    return refuse("not_direct_bank", "a Stripe payment is refunded through Stripe");
  }
  return ok({
    idempotencyKey: input.idempotencyKey,
    creditNoteReference: input.creditNoteReference,
    amountPence: input.amountPence,
    account: route.value.account,
    reason,
    requestedBy,
    status: "requested",
    audit: [{ action: "requested", actorId: requestedBy, at: input.at }],
  });
}

/**
 * The second staff member's approval. The requester is refused; approving again by the same
 * approver returns the request unchanged (a retried click is not a second approval).
 */
export function approveDirectBankRefund(
  refund: DirectBankRefund,
  approverId: string,
  at: string,
): Result<DirectBankRefund, DirectBankRefundCode> {
  const approver = approverId.trim();
  if (!approver) return refuse("bad_actor", "an approval needs its staff member");
  if (approver === refund.requestedBy) {
    return refuse("approver_is_requester", "a different staff member must approve this refund");
  }
  if (refund.status !== "requested") {
    if (refund.approvedBy === approver) return ok(refund);
    return refuse("already_approved", "this refund was approved by someone else");
  }
  return ok({
    ...refund,
    status: "approved",
    approvedBy: approver,
    audit: [...refund.audit, { action: "approved", actorId: approver, at }],
  });
}

const LONDON_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Once the money has been sent from the bank, the refund is recorded in the books against its
 * credit note (Xero today, Zoho Books in rehearsal). Only an approved refund; recording again
 * returns the record unchanged.
 */
export function recordDirectBankRefundInBooks(
  refund: DirectBankRefund,
  input: { readonly actorId: string; readonly paidOn: string; readonly at: string },
): Result<DirectBankRefund, DirectBankRefundCode> {
  if (refund.status === "recorded") return ok(refund);
  if (refund.status !== "approved") {
    return refuse("not_approved", "a second staff member must approve the refund first");
  }
  if (!LONDON_DAY.test(input.paidOn)) return refuse("bad_date", "the day paid is YYYY-MM-DD");
  const actor = input.actorId.trim();
  if (!actor) return refuse("bad_actor", "recording needs its staff member");
  return ok({
    ...refund,
    status: "recorded",
    books: {
      creditNoteReference: refund.creditNoteReference,
      amountPence: refund.amountPence,
      paidOn: input.paidOn,
    },
    audit: [...refund.audit, { action: "recorded_in_books", actorId: actor, at: input.at }],
  });
}
