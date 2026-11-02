import type { Database } from "@auction/db";
import type { PurchaseProblemCategory, PurchaseProblemStatus } from "@auction/domain";

/** A reported problem as the buyer and the staff inbox read it. */
export type PurchaseProblemRecord = {
  id: string;
  lotId: string;
  buyerLegalEntityId: string;
  paymentId: string;
  status: PurchaseProblemStatus;
  category: PurchaseProblemCategory;
  message: string;
  reportedByUserId: string | null;
  createdAt: Date;
};

export type NewPurchaseProblem = {
  lotId: string;
  buyerLegalEntityId: string;
  paymentId: string;
  category: PurchaseProblemCategory;
  message: string;
  reportedByUserId: string;
};

/** Reported purchase problems. A lot has one open report per buying account. */
export interface IPurchaseProblemRepository {
  /** The open report for a lot and account, else `null`. */
  findOpen(lotId: string, buyerLegalEntityId: string): Promise<PurchaseProblemRecord | null>;
  /**
   * Opens a report inside the caller's transaction, unless one is already open for the lot and
   * account. Returns the open report and whether this call created it.
   */
  openInTransaction(
    tx: Database,
    input: NewPurchaseProblem,
  ): Promise<{ record: PurchaseProblemRecord; created: boolean }>;
}
