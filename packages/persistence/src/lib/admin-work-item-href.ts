import { adminRoutes } from "@auction/types";
import type { AdminWorkItemSourceKind } from "../interfaces/admin-work-items.reader.js";

/** The ids a work item's link can be built from; each kind uses the ones its page is keyed by. */
export type AdminWorkItemLinkIds = {
  /** The payment, submission, lot, legal entity, case or screening the item is about. */
  subjectId?: string | null;
  saleId?: string | null;
  /** The payment a blocked capture is about. */
  paymentId?: string | null;
  /** Telephone booking status the item is filtered by on its sale tab. */
  status?: string | null;
};

/**
 * Where a work item opens. Each kind has exactly one target, so the inbox, the dashboard queue
 * and the contract test all read the same rule. Queue pages that cannot open a single record
 * (payments, condition reports, fulfilment) link to the queue itself.
 */
export function adminWorkItemHref(
  kind: AdminWorkItemSourceKind,
  ids: AdminWorkItemLinkIds,
): string {
  const subjectId = ids.subjectId ?? null;
  const saleId = ids.saleId ?? null;

  switch (kind) {
    case "payment_manual_review":
      return adminRoutes.payments.manualReview();
    case "aml_screening":
      return subjectId ? adminRoutes.aml.screening(subjectId) : adminRoutes.aml.list();
    case "sof_case":
      return subjectId
        ? adminRoutes.sourceOfFunds.detail(subjectId)
        : adminRoutes.sourceOfFunds.list();
    case "legal_entity_kyb":
      return subjectId ? adminRoutes.legalEntity(subjectId) : adminRoutes.onboardingIssues();
    case "lot_withdrawal":
    case "lot_draft_past_start":
      return subjectId ? adminRoutes.lot(subjectId) : adminRoutes.lots.list();
    case "payment_overdue":
      return requireId(kind, subjectId, adminRoutes.lot);
    case "submission_review":
      return requireId(kind, subjectId, adminRoutes.submission);
    case "unsold_lot_choice":
    case "unsold_choice_follow_up":
    case "unsold_choice_lapsed":
      return requireId(kind, subjectId, adminRoutes.submissionDecision);
    case "marketing_enquiry":
      return requireId(kind, subjectId, adminRoutes.enquiry);
    case "purchase_problem":
      return requireId(kind, subjectId, adminRoutes.purchaseProblems.record);
    case "payment_capture_blocked":
      return requireId(kind, ids.paymentId ?? null, adminRoutes.payments.panel);
    case "payment_money_unapplied":
      // Money with no single invoice (a group, or a Stripe balance) opens the payments list.
      return ids.paymentId
        ? adminRoutes.payments.panel(ids.paymentId)
        : adminRoutes.payments.list();
    case "deletion_hold":
      return requireId(kind, subjectId, adminRoutes.client);
    case "condition_report":
      return adminRoutes.conditionReports.list();
    case "lot_fulfilment":
      return adminRoutes.lotFulfilment.list();
    case "sale_registration":
      return requireId(kind, saleId, (id) => adminRoutes.sale.registrations(id, "pending"));
    case "telephone_booking":
      return requireId(kind, saleId, (id) =>
        adminRoutes.sale.telephoneBookings(id, ids.status ?? undefined),
      );
  }
}

function requireId(
  kind: AdminWorkItemSourceKind,
  id: string | null,
  build: (id: string) => string,
): string {
  if (!id) throw new Error(`Work item "${kind}" needs an id to build its link`);
  return build(id);
}
