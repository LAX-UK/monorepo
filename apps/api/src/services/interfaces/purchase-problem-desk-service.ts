import type { PurchaseProblemCategory, PurchaseProblemStatus } from "@auction/domain";
import type { AdminPurchaseProblemListQuery, AdminPurchaseProblemPatch } from "@auction/validators";

/** A report as a row of the staff list. The buyer's message is left for the record. */
export type PurchaseProblemListItem = {
  id: string;
  reference: string;
  status: PurchaseProblemStatus;
  category: PurchaseProblemCategory;
  buyerName: string;
  lot: {
    id: string;
    title: string;
    lotNumber: number | null;
    saleId: string | null;
    saleTitle: string | null;
  };
  raisedAt: string;
  assignedToUserId: string | null;
};

export type PurchaseProblemListPage = {
  items: PurchaseProblemListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Reports per status for the same filters, whichever status is shown. */
  counts: Record<PurchaseProblemStatus, number>;
  /** The sales that have reports, for the sale filter. */
  sales: Array<{ id: string; title: string }>;
};

export type PurchaseProblemNoteView = {
  id: string;
  authorUserId: string | null;
  body: string;
  createdAt: string;
};

/** One report: what the buyer wrote, the purchase it is about, and the work done on it. */
export type PurchaseProblemView = PurchaseProblemListItem & {
  message: string;
  version: number;
  payment: { id: string; status: string; amountMinor: number };
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  /** The statuses the report may move to by hand. */
  nextStatuses: PurchaseProblemStatus[];
  notes: PurchaseProblemNoteView[];
};

export type PurchaseProblemUpdateError =
  | "purchase_problem_not_found"
  | "stale_version"
  | "assignee_invalid"
  | "not_allowed"
  | "resolution_note_required"
  | "unchanged";

export type PurchaseProblemUpdateResult =
  | { ok: true; problem: PurchaseProblemView }
  | { ok: false; error: PurchaseProblemUpdateError; currentVersion?: number };

/** The staff side: list, open and work a purchase problem. */
export interface IPurchaseProblemDesk {
  list(query: AdminPurchaseProblemListQuery): Promise<PurchaseProblemListPage>;
  /** A report by id, or null when there is none. */
  detail(id: string): Promise<PurchaseProblemView | null>;
  update(
    actorUserId: string,
    id: string,
    patch: AdminPurchaseProblemPatch,
  ): Promise<PurchaseProblemUpdateResult>;
  /** The staff a report may be given to, by name. */
  assignees(): Promise<Array<{ id: string; name: string }>>;
}
