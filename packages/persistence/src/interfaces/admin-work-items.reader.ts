/** Raw row from a work-item source before SLA enrichment and action stamping. */
export type AdminWorkItemSourceRow = {
  sourceId: string;
  kind:
    | "payment_manual_review"
    | "payment_capture_blocked"
    | "payment_money_unapplied"
    | "payment_overdue"
    | "aml_screening"
    | "sof_case"
    | "submission_review"
    | "condition_report"
    | "lot_fulfilment"
    | "sale_registration"
    | "telephone_booking"
    | "legal_entity_kyb"
    | "lot_withdrawal"
    | "lot_draft_past_start"
    | "unsold_lot_choice"
    | "unsold_choice_follow_up"
    | "unsold_choice_lapsed"
    | "marketing_enquiry"
    | "purchase_problem"
    | "deletion_hold"
    | "register_lot_mismatch"
    | "reoffer_no_reply"
    | "reoffer_ready"
    | "reoffer_decision"
    | "reoffer_accepted";
  domain: "finance" | "compliance" | "catalogue" | "saleroom" | "fulfilment" | "clients";
  title: string;
  subtitle: string | null;
  /** A hedged pointer finance should read before acting (a payment the money may belong to). */
  hint?: string | null;
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
  /** Money captured on a payment that was already closed, until finance reinstates or refunds it. */
  listBlockedCaptures(limit: number): Promise<AdminWorkItemSourceRow[]>;
  /** Money received that could not be applied to an invoice, until it is refunded. */
  listUnappliedMoney(limit: number): Promise<AdminWorkItemSourceRow[]>;
  /**
   * Won lots still unpaid from the day after their due date, until staff record a buyer default,
   * the buyer pays, or the payment is held for our own checks.
   */
  listOverduePayments(limit: number, now: Date): Promise<AdminWorkItemSourceRow[]>;
  listPendingReviewTasks(query: AdminAssignableWorkItemsQuery): Promise<AdminWorkItemSourceRow[]>;
  listSubmissionReviews(query: AdminAssignableWorkItemsQuery): Promise<AdminWorkItemSourceRow[]>;
  listConditionReports(limit: number): Promise<AdminWorkItemSourceRow[]>;
  listLotFulfilment(limit: number): Promise<AdminWorkItemSourceRow[]>;
  listPendingRegistrations(limit: number): Promise<AdminWorkItemSourceRow[]>;
  listPendingTelephoneBookings(limit: number): Promise<AdminWorkItemSourceRow[]>;
  listDraftLotsPastStart(limit: number): Promise<AdminWorkItemSourceRow[]>;
  /** Sellers' choices for unsold lots waiting for a specialist to confirm. */
  listUnsoldLotChoices(limit: number): Promise<AdminWorkItemSourceRow[]>;
  /** Choices a specialist confirmed whose work (relist, return, private sale) is still open. */
  listOpenUnsoldFollowUps(limit: number): Promise<AdminWorkItemSourceRow[]>;
  /** Unsold lots whose choose-by date has passed with no choice made, for the specialist to contact the seller. */
  listLapsedUnsoldChoices(limit: number, now: Date): Promise<AdminWorkItemSourceRow[]>;
  /** Contact form enquiries waiting for client services. */
  listMarketingEnquiries(limit: number): Promise<AdminWorkItemSourceRow[]>;
  /** Problems buyers reported on paid purchases, waiting for client services. */
  listPurchaseProblems(limit: number): Promise<AdminWorkItemSourceRow[]>;
  /** Account deletions the daily purge is holding, waiting for client services. */
  listDeletionHolds(limit: number): Promise<AdminWorkItemSourceRow[]>;
  /** Artworks the register places in a LAX Bid sale whose lot is not live; staff decide, nothing changes. */
  listRegisterLotMismatches(limit: number): Promise<AdminWorkItemSourceRow[]>;
  /** What a buyer default's re-offer leaves staff: no seller reply, ready to send, decide, accepted. */
  listReofferWork(limit: number, now: Date): Promise<AdminWorkItemSourceRow[]>;
}
