import type { Database } from "@auction/db";
import type { InvoiceLine, InvoiceSource } from "@auction/types";
import type { CreatePaymentRow, PaymentRecord } from "./payment-write.repository.js";

/** An invoice as stored: its figures, its due date and its lines in order. */
export type BidInvoiceRecord = {
  id: string;
  lotId: string;
  buyerLegalEntityId: string;
  sellerLegalEntityId: string;
  totalPence: number;
  raisedAt: Date;
  dueAt: Date;
  pricingPolicyId: string | null;
  /** Our own invoice number; assigned when the invoice document is issued. */
  number: string | null;
  source: InvoiceSource;
  voidedAt: Date | null;
  lines: InvoiceLine[];
};

/** An invoice about to be raised: its lines already add up to `totalPence`. */
export type NewBidInvoice = {
  lotId: string;
  buyerLegalEntityId: string;
  sellerLegalEntityId: string;
  totalPence: number;
  raisedAt: Date;
  dueAt: Date;
  pricingPolicyId: string | null;
  lines: InvoiceLine[];
};

/**
 * The lot's live invoice has a different total from the one being raised. Raising joins an
 * existing invoice as it is and never changes its figures, so the request is refused rather than
 * storing a payment that disagrees with its invoice.
 */
export class BidInvoiceTotalMismatchError extends Error {
  constructor(
    readonly invoiceId: string,
    readonly storedPence: number,
    readonly requestedPence: number,
  ) {
    super(
      `Invoice ${invoiceId} totals ${storedPence} pence, not the ${requestedPence} pence being raised`,
    );
    this.name = "BidInvoiceTotalMismatchError";
  }
}

/**
 * The lot is no longer sold to the buyer the invoice was being raised for: between reading the lot
 * and raising its invoice it was defaulted, re-awarded, reopened or moved to another buying
 * account. Nothing is stored, so no invoice or payment is left for someone who no longer owns it.
 */
export class BidInvoiceLotMovedError extends Error {
  constructor(readonly lotId: string) {
    super(`Lot ${lotId} is no longer sold to the buyer this invoice was raised for`);
    this.name = "BidInvoiceLotMovedError";
  }
}

/** Reading the live invoices of many lots at once, for lists. */
export interface IBidInvoiceBatchReader {
  /**
   * The live invoice of each (lot, buyer account) pair that has one, with its lines, in one read.
   * Keyed by `bidInvoiceKey(lotId, buyerLegalEntityId)`.
   */
  findLiveByLotsAndBuyerAccounts(
    pairs: readonly { lotId: string; buyerLegalEntityId: string }[],
  ): Promise<Map<string, BidInvoiceRecord>>;
}

/** The key of a (lot, buyer account) pair in a batch read. */
export function bidInvoiceKey(lotId: string, buyerLegalEntityId: string): string {
  return `${lotId}:${buyerLegalEntityId}`;
}

export interface IBidInvoiceReader {
  /** The invoice of a lot for a buyer account that has not been voided, with its lines. */
  findLiveByLotAndBuyerAccount(
    lotId: string,
    buyerLegalEntityId: string,
  ): Promise<BidInvoiceRecord | null>;
  /** The invoice behind each payment (keyed by payment id), with its lines. */
  findByPaymentIds(paymentIds: readonly string[]): Promise<Map<string, BidInvoiceRecord>>;
}

/** What raising an invoice produced. `invoiceCreated` is false when it joined an existing one. */
export type RaisedInvoice = {
  invoice: BidInvoiceRecord;
  payment: PaymentRecord;
  invoiceCreated: boolean;
};

export interface IBidInvoiceRaiseRepository {
  /**
   * Stores the invoice with its lines and the payment row that settles it, in one transaction.
   * The transaction first locks the lot row (`FOR UPDATE`, lot first, as a buyer default and a
   * re-award do) and requires it to be still ended, won by `winnerId` and bought in
   * `invoice.buyerLegalEntityId`; otherwise it throws `BidInvoiceLotMovedError` and stores nothing.
   * `winnerId` is the lot's winner as the caller read it; the payer (`payment.paidByUserId`) is
   * that winner at lot end, or one of the buying account's payers at checkout.
   * When the lot already has a live invoice for the buyer account (a retry after the previous
   * payment expired, or a request that raced this one) the existing invoice is used as is: it is
   * not priced again and its due date does not move, and the payment row takes its total.
   * Throws the payment table's unique violation when an open payment already exists; nothing is
   * stored then.
   */
  raise(input: {
    invoice: NewBidInvoice;
    winnerId: string;
    payment: Omit<CreatePaymentRow, "amount" | "invoiceId">;
  }): Promise<RaisedInvoice>;
}

/**
 * Whose unpaid invoices a hold release reaches. `holdStartedAt` is when the hold began: an invoice
 * whose due date had already passed by then was overdue before the hold and keeps its date.
 */
export type OpenInvoiceScope = { holdStartedAt: Date } & (
  | /** Every invoice of one buyer account. */ { kind: "account"; legalEntityId: string }
  | /** The invoices of lots a person won, in any account or only in their personal ones. */ {
      kind: "winner";
      userId: string;
      personalAccountsOnly: boolean;
    }
);

export interface IBidInvoiceDueDateRepository {
  /**
   * Moves, in one statement, the due date of every live invoice in `scope` that is still unpaid
   * (not voided, and with no payment that is paid, being confirmed, refunded or held for review)
   * to `until` when that is later. An invoice due before `scope.holdStartedAt` was overdue before
   * the hold and is not touched. Never moves a date earlier; repeating it changes nothing. Returns
   * how many moved. With `tx` it runs inside that transaction.
   */
  extendUnpaidDueDates(scope: OpenInvoiceScope, until: Date, tx?: Database): Promise<number>;

  /**
   * Moves the due date of an invoice to `notBefore` when that is later, once a hold that kept the
   * buyer from paying is released. It never moves a due date earlier. Returns whether it moved.
   * With `tx` it runs inside that transaction, so it commits or rolls back with the release.
   */
  extendDueAt(invoiceId: string, notBefore: Date, tx?: Database): Promise<boolean>;
}
