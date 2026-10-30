import type { SubmissionSenderFilter } from "./item-submission.repository.js";

/** What the agreement document names besides the agreement itself. */
export type AgreementDocumentFacts = {
  submissionId: string;
  legalEntityId: string;
  workTitle: string;
  referenceNumber: number;
  /** The selling account's legal name, else its display name. */
  sellerName: string;
};

export interface IAgreementDocumentFactsReader {
  factsFor(submissionId: string): Promise<AgreementDocumentFacts | null>;
}

type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "refunded"
  | "requires_manual_review"
  | "cancelled";
type PayoutStatus =
  | "scheduled"
  | "in_transit"
  | "paid"
  | "failed"
  | "reversed"
  | "clawback_pending";

/** One lot the account sold, with the buyer's payment and the payout it is on. */
export type SoldLotRow = {
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  saleTitle: string | null;
  soldAt: Date;
  hammerPrice: string;
  /** The buyer's payment, open or settled, or `null` before one exists. */
  payment: { status: PaymentStatus; amount: string; platformFee: string } | null;
  /** The payout the sale is on, or `null` while it is on none. */
  payout: { id: string; status: PayoutStatus; settledAt: Date | null } | null;
};

export interface ISoldLotsReader {
  /** Lots sold for the account, newest first, optionally only those that sold in [from, to). */
  list(input: {
    legalEntityId: string;
    from?: Date;
    to?: Date;
    limit: number;
    offset: number;
  }): Promise<SoldLotRow[]>;
}

/** One line of a payout, with the lot and payment a sale line settles. */
export type PayoutLineRow = {
  id: string;
  kind: string;
  amount: string;
  note: string | null;
  lot: { id: string; title: string; lotNumber: number | null; hammerPrice: string } | null;
  payment: { amount: string; platformFee: string } | null;
};

export type PayoutWithLines = {
  id: string;
  status: PayoutStatus;
  currency: string;
  grossAmount: string;
  platformFee: string;
  stripeFee: string;
  netAmount: string;
  periodStart: Date;
  periodEnd: Date;
  processedAt: Date | null;
  lines: PayoutLineRow[];
};

export interface IPayoutLinesReader {
  /** The account's payout with its lines; `null` when it is not the account's. */
  find(legalEntityId: string, payoutId: string): Promise<PayoutWithLines | null>;
}

/** A consigned work that did not sell and was chosen to come back to the seller. */
export type ReturnedWorkRow = {
  submissionId: string;
  lotId: string;
  title: string;
  medium: string | null;
  referenceNumber: number;
  /** When the return was confirmed. */
  returnedAt: Date | null;
};

export interface IReturnedWorksReader {
  list(input: {
    legalEntityId: string;
    visibleTo: SubmissionSenderFilter | undefined;
    limit: number;
    offset: number;
  }): Promise<ReturnedWorkRow[]>;
}
