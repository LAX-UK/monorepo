import type { Database } from "@auction/db";
import type { Underbidder } from "@auction/domain";
import type { LotStatus, PaymentStatus } from "@auction/types";

/** What a buyer default is decided from: the lot, its invoice and delivery, and who else bid. */
export type BuyerDefaultLotFacts = {
  lot: {
    id: string;
    title: string;
    lotNumber: number | null;
    status: LotStatus;
    saleId: string | null;
    winnerId: string | null;
    buyerLegalEntityId: string | null;
    sellerLegalEntityId: string | null;
    hammerPrice: string;
    wonAt: Date;
  };
  /** The latest invoice for the lot and winning account, or `null` before one is raised. */
  payment: {
    id: string;
    status: PaymentStatus;
    amount: string;
    raisedAt: Date;
    /** The due date stored on the invoice; `null` for a payment with no stored invoice. */
    dueAt: Date | null;
  } | null;
  fulfilmentStatus: string | null;
  hasOpenDispute: boolean;
  /** Every bid on the lot with the account behind it, to find the next bidder. */
  bids: Underbidder[];
};

export interface IBuyerDefaultReader {
  readFacts(lotId: string): Promise<BuyerDefaultLotFacts | null>;
}

export type RecordBuyerDefaultInput = {
  lotId: string;
  /** The buyer and account the facts were read for; the write refuses if the lot moved on. */
  buyerId: string;
  buyerLegalEntityId: string;
  sellerLegalEntityId: string;
  paymentId: string | null;
  hammerPrice: string;
  wonAt: Date;
  reason: string;
  outcome: "returned_to_inventory" | "offered_to_underbidder";
  buyerRestricted: boolean;
  actorUserId: string;
};

/** The lot or its invoice changed between reading the facts and writing the default. */
export class BuyerDefaultConflictError extends Error {
  constructor(message = "The lot or its payment changed. Reload and try again.") {
    super(message);
    this.name = "BuyerDefaultConflictError";
  }
}

export interface IBuyerDefaultRepository {
  /**
   * In the caller's transaction: voids the invoice (cancelled, kept), cancels the sale's
   * delivery record, takes the winner off the lot and records the default. Throws
   * `BuyerDefaultConflictError` when the lot is no longer won by the buyer or the invoice is no
   * longer unpaid.
   */
  record(tx: Database, input: RecordBuyerDefaultInput): Promise<{ id: string }>;
  /** Whether an invoice was voided by a buyer default (it must never be reinstated). */
  isVoided(paymentId: string): Promise<boolean>;
}

export type PaymentReminderCandidate = {
  paymentId: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  lotStatus: LotStatus;
  winnerId: string | null;
  buyerId: string;
  buyerLegalEntityId: string;
  amount: string;
  paymentStatus: PaymentStatus;
  raisedAt: Date;
  /** The due date stored on the invoice; `null` for a payment with no stored invoice. */
  dueAt: Date | null;
  fulfilmentStatus: string | null;
  sentSteps: string[];
};

export interface IPaymentReminderStore {
  /** Unpaid invoices that may still have a reminder to send, oldest first. */
  listCandidates(limit: number): Promise<PaymentReminderCandidate[]>;
  /** Takes a step for an invoice; `false` when it was already taken (nothing to send). */
  claim(paymentId: string, step: string): Promise<boolean>;
  /** Gives a step back when its notice could not be queued, so the next run retries it. */
  release(paymentId: string, step: string): Promise<void>;
}
