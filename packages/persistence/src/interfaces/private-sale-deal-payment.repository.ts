import type {
  PayoutLine,
  PrivateSaleDealPayment,
  PrivateSalePaymentRail,
  PrivateSalePayoutDeal,
} from "@auction/types";

export type NewPrivateSaleDealPayment = {
  dealId: string;
  buyerLegalEntityId: string;
  createdByUserId: string | null;
  rail: PrivateSalePaymentRail;
  amountMinor: number;
};

/** A deal has one live payment. Asking for another returns the one that holds the deal. */
export type ClaimDealPaymentResult =
  | { kind: "created"; payment: PrivateSaleDealPayment }
  | { kind: "existing"; payment: PrivateSaleDealPayment };

export interface IPrivateSaleDealPaymentReader {
  findById(id: string): Promise<PrivateSaleDealPayment | null>;
  /** The payment that holds the deal: open, processing or paid. */
  findLiveForDeal(dealId: string): Promise<PrivateSaleDealPayment | null>;
  findByPaymentIntentId(paymentIntentId: string): Promise<PrivateSaleDealPayment | null>;
  findByChargeId(chargeId: string): Promise<PrivateSaleDealPayment | null>;
  /** Newest first. */
  listForDeal(dealId: string): Promise<PrivateSaleDealPayment[]>;
  /** Reads the payment and locks its row until the surrounding transaction ends. */
  findByIdForUpdate(id: string): Promise<PrivateSaleDealPayment | null>;
}

/** Each move is applied only from the statuses that may make it, and returns `null` otherwise. */
export interface IPrivateSaleDealPaymentWriter {
  claim(input: NewPrivateSaleDealPayment): Promise<ClaimDealPaymentResult>;
  recordCheckout(
    id: string,
    checkout: { sessionId: string; paymentIntentId: string | null },
  ): Promise<void>;
  markProcessing(id: string): Promise<PrivateSaleDealPayment | null>;
  markPaid(
    id: string,
    paid: { chargeId: string | null; paymentIntentId: string | null; at: Date },
  ): Promise<PrivateSaleDealPayment | null>;
  markCancelled(id: string): Promise<PrivateSaleDealPayment | null>;
  markRefunded(
    id: string,
    refund: { refundedMinor: number; refundId: string | null; at: Date },
  ): Promise<PrivateSaleDealPayment | null>;
}

/** What the invoice stage leaves on the deal, and what the buyer's other open deals add up to. */
export interface IPrivateSaleDealFinanceStore {
  recordInvoiceReference(dealId: string, reference: string): Promise<void>;
  /** The prices of the buyer's other deals that are agreed but not yet paid out, in pence. */
  sumOtherOpenExposureMinor(buyerLegalEntityId: string, excludeDealId: string): Promise<number>;
}

/** The seller's side of released deals: what the payout run reads and the line it writes. */
export interface IPrivateSaleDealPayoutStore {
  /** Released deals of the seller whose buyer has paid and that no payout line settles yet. */
  findUnsettledReleased(sellerLegalEntityId: string): Promise<PrivateSalePayoutDeal[]>;
  listSellerLegalEntityIdsWithUnsettledReleased(): Promise<string[]>;
  /**
   * Adds the sale line that settles the deal to the payout, for the deal's price as a decimal
   * amount. Returns `null` when a line already settles the deal.
   */
  insertSaleLine(input: {
    payoutId: string;
    dealId: string;
    amount: string;
  }): Promise<PayoutLine | null>;
  /** Whether a payout line already settles the deal, so its money can no longer be pulled back. */
  hasPayoutLine(dealId: string): Promise<boolean>;
  /** Released deals whose payout has been paid, so the deal can be settled. */
  listReleasedWithPaidPayout(limit: number): Promise<{ dealId: string; payoutId: string }[]>;
}
