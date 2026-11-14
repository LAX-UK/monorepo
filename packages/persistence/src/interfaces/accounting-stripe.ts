import type {
  AccountingDocument,
  LegalEntity,
  Product,
  StripeParkReason,
} from "@auction/accounting-domain";

/** A Stripe account LAX reads, which product its own movements belong to, and how far it is read. */
export interface StripeAccountState {
  readonly stripeAccountId: string;
  readonly product: Product;
  /** Every balance transaction created before this is recorded; null before the first run. */
  readonly readThrough: Date | null;
  /** The Stripe balance the Books clearing account opened with, and the London day; or null. */
  readonly opening: { readonly balancePence: number; readonly on: string } | null;
}

/** The ids LAX may have stored for the money behind a balance transaction. */
export interface StripeChargeRefs {
  readonly paymentIntentId: string | null;
  readonly chargeId: string | null;
}

/** One balance transaction as read from Stripe, ids and amounts only (no names, no emails). */
export interface StripeBalanceRow {
  readonly stripeAccountId: string;
  readonly id: string;
  readonly type: string;
  readonly currency: string;
  readonly amountPence: number;
  readonly feePence: number;
  readonly createdAt: Date;
  /** London calendar day of `createdAt`. */
  readonly createdOn: string;
  readonly sourceId: string | null;
  readonly payoutId: string | null;
}

/** What the job decided for one balance transaction. */
export type StripeBalanceOutcome =
  | {
      readonly outcome: "booked";
      readonly product: Product;
      readonly documents: readonly AccountingDocument[];
      readonly feePence: number;
      readonly payoutPence: number;
    }
  | {
      readonly outcome: "parked";
      readonly product: Product | null;
      readonly reason: StripeParkReason;
    }
  | { readonly outcome: "nothing"; readonly product: Product | null }
  /** Something to book, but Books is not aimed at the product: recorded, never booked later. */
  | { readonly outcome: "not_aimed"; readonly product: Product };

/** `parked_instead`: the outcome could not be recorded as given, so it was recorded parked. */
export type StripeRecordResult = "recorded" | "already_recorded" | "parked_instead";

/**
 * The daily Stripe job's store. `record` is the duplicate guard: the balance transaction's row is
 * inserted and its documents registered in one database transaction, by whichever run inserts the
 * row first; every other run (a re-run, a concurrent one) finds the row and does nothing. A
 * document the registry refuses (a reference already holding a different document), or a value
 * the row's CHECKs refuse, rolls that back and the transaction is recorded parked `unrecognised`
 * instead, with no documents, for a person to look at. A document that replays a cancelled one
 * (a rollback cancelled it) is never sent, so that transaction is parked `was_cancelled`. Any other
 * error is thrown.
 */
export interface IStripeBooksLedger {
  accounts(): Promise<readonly StripeAccountState[]>;
  /**
   * The products whose stored rows hold this money: a Bid payment or payment group with the
   * charge or PaymentIntent, a Shop order with the PaymentIntent. Empty when none does.
   */
  productsForCharge(refs: StripeChargeRefs): Promise<readonly Product[]>;
  record(row: StripeBalanceRow, outcome: StripeBalanceOutcome): Promise<StripeRecordResult>;
  /** Moves the cursor forward to `readThrough` (never back). */
  advanceCursor(stripeAccountId: string, readThrough: Date): Promise<void>;
}

/** One day's totals of one document kind, as LAX expects them and as Books holds them. */
export interface DayKindTotals {
  readonly kind: "payment" | "expense" | "transfer";
  /** What LAX says should be in Books (pence, count). */
  readonly laxPence: number;
  readonly laxCount: number;
  /** What Books holds: documents issued for the target (pence from Books' own totals, count). */
  readonly booksPence: number;
  readonly booksCount: number;
  /** Documents registered but not issued yet (queued, sending, waiting for a person). */
  readonly notIssuedCount: number;
  readonly notIssuedPence: number;
}

/** A balance transaction parked for a person, ids only. */
export interface ParkedBalanceTransaction {
  readonly stripeAccountId: string;
  readonly balanceTransactionId: string;
  readonly type: string;
  readonly reason: string;
  readonly amountPence: number;
  readonly feePence: number;
}

/** What one company's clearing account holds in Books, by kind, since it opened. */
export interface ClearingMovements {
  readonly paymentsPence: number;
  readonly expensesPence: number;
  readonly transfersPence: number;
  /** Registered for Books, dated since opening, not yet issued: in flight, not a difference. */
  readonly notIssuedPence: number;
}

/** Money that moved in a Stripe balance outside the clearing figure, by balance transaction type. */
export interface UnbookedMovement {
  readonly type: string;
  /** Signed as Stripe signs it: negative when it left the balance (a seller transfer, a refund). */
  readonly pence: number;
}

/** Reads behind the daily reconciliation report, and the record of each report stored. */
export interface IStripeReconciliationStore {
  /**
   * For one company and London day: per kind, LAX's figure (expenses and transfers from the
   * balance transaction rows booked; payments from the documents LAX registered) against the
   * documents issued for `target`.
   */
  dayTotals(
    entity: LegalEntity,
    day: string,
    target: { readonly provider: "books"; readonly mode: string },
  ): Promise<readonly DayKindTotals[]>;
  parkedOn(entity: LegalEntity, day: string): Promise<readonly ParkedBalanceTransaction[]>;
  /** The company's Stripe accounts with their opening balance (null when not stated). */
  openings(entity: LegalEntity): Promise<readonly StripeAccountState[]>;
  /** Clearing movements in Books for `target`, dated on or after `since`, through `through`. */
  clearingSince(
    entity: LegalEntity,
    since: string,
    through: string,
    target: { readonly provider: "books"; readonly mode: string },
  ): Promise<ClearingMovements>;
  /**
   * For the company's accounts, since each one's opening day: what the ledger's recorded
   * transactions moved in the balance that the clearing figure does not take from Books (seller
   * transfers, refunds, dispute amounts), by type, leaving out what this job booked and the charges the payments flow books.
   * Parked and not-aimed rows are left out: they are differences.
   */
  knownUnbooked(entity: LegalEntity): Promise<readonly UnbookedMovement[]>;
  /**
   * Seller payouts held in the Stripe balance and not yet transferred (Bid's `payout` rows that
   * are scheduled or blocked), in pence. Null for a company whose held funds LAX does not track.
   */
  heldTransferPence(entity: LegalEntity): Promise<number | null>;
  saveReport(input: {
    readonly entity: LegalEntity;
    readonly day: string;
    readonly storageKey: string;
    readonly mismatches: number;
    readonly generatedAt: Date;
  }): Promise<void>;
}
