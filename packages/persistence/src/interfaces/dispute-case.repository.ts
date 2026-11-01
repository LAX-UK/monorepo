import type { Database } from "@auction/db";
import type {
  DisputeAllocationLine,
  DisputeAllocationSource,
  DisputeAllocationState,
  DisputeCandidate,
  DisputeLineClawback,
} from "@auction/domain";

/** Stripe's copy of a dispute, as one webhook reported it. */
export type DisputeStripeSnapshot = {
  status: string;
  amountPence: number;
  currency: string;
  reason: string | null;
  networkReasonCode: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  dueBy: Date | null;
  evidenceSubmitted: boolean;
  chargeRefundable: boolean | null;
  /** When Stripe created the event this copy came from. */
  eventAt: Date;
  /** Set once the dispute has ended. */
  closedAt: Date | null;
};

export type NewDisputeCase = {
  stripeDisputeId: string;
  stripeChargeId: string;
  stripePaymentIntentId: string | null;
  stripeCreatedAt: Date;
  allocationState: DisputeAllocationState;
  snapshot: DisputeStripeSnapshot;
  fundsWithdrawnAt: Date | null;
  fundsReinstatedAt: Date | null;
  candidatePaymentIds: readonly string[];
};

export type DisputeCaseRecord = {
  id: string;
  stripeDisputeId: string;
  stripeChargeId: string;
  stripePaymentIntentId: string | null;
  amountPence: number;
  currency: string;
  reason: string | null;
  networkReasonCode: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  status: string;
  dueBy: Date | null;
  evidenceSubmitted: boolean;
  chargeRefundable: boolean | null;
  allocationState: DisputeAllocationState;
  fundsWithdrawnAt: Date | null;
  fundsReinstatedAt: Date | null;
  stripeCreatedAt: Date;
  lastEventAt: Date;
  closedAt: Date | null;
  version: number;
};

export type DisputeAllocationRecord = DisputeAllocationLine & {
  id: string;
  caseId: string;
  clawback: DisputeLineClawback;
  source: DisputeAllocationSource;
};

export type NewDisputeAllocation = DisputeAllocationLine & {
  clawback: DisputeLineClawback;
  source: DisputeAllocationSource;
  allocatedByUserId: string | null;
};

/** Dispute cases and their allocation, written only inside the caller's transaction. */
export interface IDisputeCaseRepository {
  /**
   * Records the case and links its candidate invoices, unless the dispute is already recorded;
   * either way returns the case locked (`FOR UPDATE`). `created` tells whether this call made it.
   */
  insertOrLockInTransaction(
    tx: Database,
    input: NewDisputeCase,
  ): Promise<{ record: DisputeCaseRecord; created: boolean }>;
  lockByStripeIdInTransaction(
    tx: Database,
    stripeDisputeId: string,
  ): Promise<DisputeCaseRecord | null>;
  lockByIdInTransaction(tx: Database, caseId: string): Promise<DisputeCaseRecord | null>;
  applySnapshotInTransaction(
    tx: Database,
    caseId: string,
    snapshot: DisputeStripeSnapshot,
  ): Promise<void>;
  recordFundsInTransaction(
    tx: Database,
    caseId: string,
    funds: { fundsWithdrawnAt: Date | null; fundsReinstatedAt: Date | null },
  ): Promise<void>;
  /** Moves the case to `allocated` and bumps its version; `false` when the version moved on. */
  markAllocatedInTransaction(
    tx: Database,
    caseId: string,
    expectedVersion: number,
  ): Promise<boolean>;
  listCandidatePaymentIdsInTransaction(tx: Database, caseId: string): Promise<string[]>;
  listAllocationsInTransaction(tx: Database, caseId: string): Promise<DisputeAllocationRecord[]>;
  insertAllocationsInTransaction(
    tx: Database,
    caseId: string,
    lines: readonly NewDisputeAllocation[],
  ): Promise<DisputeAllocationRecord[]>;
  setClawbackInTransaction(
    tx: Database,
    allocationId: string,
    clawback: DisputeLineClawback,
  ): Promise<void>;
}

/** How many cases wait for the finance team to allocate them. */
export interface IDisputeAllocationQueueReader {
  countAwaitingAllocation(): Promise<number>;
}

/** A line the ledger already holds for a dispute recorded before cases existed. */
export type LegacyDisputeLine = DisputeAllocationLine & { clawback: DisputeLineClawback };

/** The invoices a dispute can fall on, read inside the caller's transaction. */
export interface IDisputePaymentReader {
  /** Every payment the charge settled (by charge, else by PaymentIntent). */
  listByChargeInTransaction(
    tx: Database,
    refs: { chargeId: string; paymentIntentId: string | null },
  ): Promise<DisputeCandidate[]>;
  findByIdsInTransaction(tx: Database, paymentIds: readonly string[]): Promise<DisputeCandidate[]>;
  /**
   * What the payment events already published for this dispute put on the ledger: the invoices
   * it was opened on, and whether each was clawed back or reversed.
   */
  legacyLinesInTransaction(tx: Database, stripeDisputeId: string): Promise<LegacyDisputeLine[]>;
}
