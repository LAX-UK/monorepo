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
   * When the lot already has a live invoice for the buyer account (a retry after the previous
   * payment expired, or a request that raced this one) the existing invoice is used as is: it is
   * not priced again and its due date does not move, and the payment row takes its total.
   * Throws the payment table's unique violation when an open payment already exists; nothing is
   * stored then.
   */
  raise(input: {
    invoice: NewBidInvoice;
    payment: Omit<CreatePaymentRow, "amount" | "invoiceId">;
  }): Promise<RaisedInvoice>;
}

/** Whose unpaid invoices a hold release reaches. */
export type OpenInvoiceScope =
  /** Every invoice of one buyer account. */
  | { kind: "account"; legalEntityId: string }
  /** The invoices of lots a person won, in any account or only in their personal ones. */
  | { kind: "winner"; userId: string; personalAccountsOnly: boolean };

export interface IBidInvoiceDueDateRepository {
  /**
   * The ids of the live invoices in `scope` that are still unpaid: not voided, and with no payment
   * that is paid, being confirmed, refunded or held for review. With `tx` it reads inside that
   * transaction.
   */
  listUnpaidLiveInvoiceIds(scope: OpenInvoiceScope, tx?: Database): Promise<string[]>;

  /**
   * Moves the due date of an invoice to `notBefore` when that is later, once a hold that kept the
   * buyer from paying is released. It never moves a due date earlier. Returns whether it moved.
   * With `tx` it runs inside that transaction, so it commits or rolls back with the release.
   */
  extendDueAt(invoiceId: string, notBefore: Date, tx?: Database): Promise<boolean>;
}
