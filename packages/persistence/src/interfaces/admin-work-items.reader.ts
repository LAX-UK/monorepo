/** Raw row from a work-item source before SLA enrichment and action stamping. */
export type AdminWorkItemSourceRow = {
  sourceId: string;
  kind:
    | "payment_manual_review"
    | "aml_screening"
    | "sof_case"
    | "submission_review"
    | "condition_report"
    | "lot_fulfilment"
    | "sale_registration"
    | "telephone_booking"
    | "legal_entity_kyb"
    | "lot_withdrawal"
    | "lot_draft_past_start";
  domain: "finance" | "compliance" | "catalogue" | "saleroom" | "fulfilment" | "clients";
  title: string;
  subtitle: string | null;
  href: string;
  saleId: string | null;
  createdAt: Date;
  sourceUpdatedAt: Date;
  assignedToUserId: string | null;
  /** Kind-specific metadata for action availability (e.g. fulfilment status). */
  meta?: Record<string, string | null | undefined>;
};

export type AdminWorkItemSourceKind = AdminWorkItemSourceRow["kind"];

export type AdminAssignableWorkItemsQuery = {
  limit: number;
  assignment: "mine" | "unassigned" | "all";
  actorUserId: string;
};

export interface IAdminWorkItemsReader {
  listManualReviewPayments(limit: number): Promise<AdminWorkItemSourceRow[]>;
  listPendingReviewTasks(query: AdminAssignableWorkItemsQuery): Promise<AdminWorkItemSourceRow[]>;
  listSubmissionReviews(query: AdminAssignableWorkItemsQuery): Promise<AdminWorkItemSourceRow[]>;
  listConditionReports(limit: number): Promise<AdminWorkItemSourceRow[]>;
  listLotFulfilment(limit: number): Promise<AdminWorkItemSourceRow[]>;
  listPendingRegistrations(limit: number): Promise<AdminWorkItemSourceRow[]>;
  listPendingTelephoneBookings(limit: number): Promise<AdminWorkItemSourceRow[]>;
  listDraftLotsPastStart(limit: number): Promise<AdminWorkItemSourceRow[]>;
}
