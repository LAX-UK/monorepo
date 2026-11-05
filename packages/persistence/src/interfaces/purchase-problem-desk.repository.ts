import type { Database } from "@auction/db";
import type { PurchaseProblemCategory, PurchaseProblemStatus } from "@auction/domain";

/** A reported purchase problem with the purchase it is about, as staff read it. */
export type PurchaseProblemDeskRecord = {
  id: string;
  status: PurchaseProblemStatus;
  category: PurchaseProblemCategory;
  /** What the buyer wrote. Personal data. */
  message: string;
  version: number;
  assignedToUserId: string | null;
  resolvedByUserId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  buyer: { legalEntityId: string; name: string; reportedByUserId: string | null };
  lot: {
    id: string;
    title: string;
    lotNumber: number | null;
    saleId: string | null;
    saleTitle: string | null;
  };
  payment: { id: string; status: string; amountMinor: number };
};

export type PurchaseProblemDeskQuery = {
  status?: PurchaseProblemStatus;
  saleId?: string;
  /** A staff id, or "unassigned". */
  assignee?: string;
  /** A reference, buyer name or lot title. */
  search?: string;
  limit: number;
  offset: number;
};

/** Reports per status for the same filters, ignoring the status itself. */
export type PurchaseProblemStatusCounts = Record<PurchaseProblemStatus, number>;

/** What a staff change sets. A missing key is left as it is. */
export type PurchaseProblemChange = {
  status?: PurchaseProblemStatus;
  assignedToUserId?: string | null;
  resolved?: { at: Date; byUserId: string } | null;
};

export type PurchaseProblemNoteRecord = {
  id: string;
  purchaseProblemId: string;
  authorUserId: string | null;
  body: string;
  createdAt: Date;
};

/** Reads and staff changes for the purchase problems list and record. */
export interface IPurchaseProblemDeskRepository {
  list(query: PurchaseProblemDeskQuery): Promise<{
    rows: PurchaseProblemDeskRecord[];
    total: number;
  }>;
  counts(
    filters: Pick<PurchaseProblemDeskQuery, "saleId" | "assignee" | "search">,
  ): Promise<PurchaseProblemStatusCounts>;
  /** The sales that have at least one report, for the sale filter. */
  salesWithReports(): Promise<Array<{ id: string; title: string }>>;
  findById(id: string): Promise<PurchaseProblemDeskRecord | null>;
  /**
   * Applies a change if the report is still at `version`, and bumps the version. Returns the
   * report, or null when it moved on or does not exist.
   */
  updateInTransaction(
    tx: Database,
    id: string,
    version: number,
    change: PurchaseProblemChange,
  ): Promise<PurchaseProblemDeskRecord | null>;
}

/** Internal notes on a report. */
export interface IPurchaseProblemNoteRepository {
  addInTransaction(
    tx: Database,
    input: { purchaseProblemId: string; authorUserId: string; body: string },
  ): Promise<PurchaseProblemNoteRecord>;
  /** Oldest first. */
  listForProblem(purchaseProblemId: string): Promise<PurchaseProblemNoteRecord[]>;
}
