/**
 * The ONE list of Bid staff actions that need a recent sign-in (step-up).
 *
 * Add a route here and the gate (`dangerous-staff-action-gate.ts`) demands a recent
 * authentication for it; routes stay thin and never repeat the check. Paths are relative to the
 * API root, written as Hono patterns (`:param` matches one segment).
 *
 * `enforcedBy: "gate"` routes sit under the `/admin` app, where the gate is mounted.
 * `enforcedBy: "route"` routes live in another router that mounts the same middleware itself
 * (payouts, buyer refunds); they are listed so the inventory stays complete.
 *
 * LAX Admin (Shop) has its own list in apps/shop-api and is not covered here.
 */

export type DangerousActionCategory =
  | "refund"
  | "invoice_void"
  | "payout_release"
  | "payout_override"
  | "role_permission"
  | "erasure"
  | "kyc_sof_decision"
  | "amount_change"
  | "sign_in_protection"
  | "destructive_catalogue"
  | "personal_data_export"
  | "goods_release"
  | "collection_settings"
  | "collection_handover";

export type DangerousStaffAction = {
  id: string;
  category: DangerousActionCategory;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  enforcedBy: "gate" | "route";
};

const a = (
  category: DangerousActionCategory,
  id: string,
  method: DangerousStaffAction["method"],
  path: string,
  enforcedBy: DangerousStaffAction["enforcedBy"] = "gate",
): DangerousStaffAction => ({ id, category, method, path, enforcedBy });

export const DANGEROUS_STAFF_ACTIONS: readonly DangerousStaffAction[] = [
  // Refunds and releasing held money
  a("refund", "payment.refund-buyer", "POST", "/admin/payments/:id/refund-buyer"),
  a(
    "refund",
    "payment.refund-blocked-capture",
    "POST",
    "/admin/payments/:id/refund-blocked-capture",
  ),
  a("refund", "payment.refund", "POST", "/payments/:id/refund", "route"),
  a("payout_release", "payment.capture", "POST", "/payments/:id/capture", "route"),
  a(
    "payout_release",
    "payment.capture-and-process",
    "POST",
    "/admin/payments/:id/capture-and-process",
  ),
  a(
    "payout_release",
    "payment.reinstate-blocked-capture",
    "POST",
    "/admin/payments/:id/reinstate-blocked-capture",
  ),
  a(
    "payout_release",
    "payment.unapplied-money.mark-handled",
    "POST",
    "/admin/payments/unapplied-money/:key/mark-handled",
  ),
  a("payout_release", "dispute.allocation", "POST", "/admin/finance/dispute-cases/:id/allocation"),
  a("payout_release", "lot.buyer-default", "POST", "/admin/lots/:lotId/buyer-default"),
  // Offering a defaulted lot to the next bidder moves the sale to a new buyer
  a("payout_release", "lot.reoffer-start", "POST", "/admin/lots/:lotId/reoffers"),
  a("payout_release", "reoffer.seller-answer", "POST", "/admin/reoffers/:reofferId/seller-answer"),
  a("payout_release", "reoffer.send", "POST", "/admin/reoffers/:reofferId/send"),
  a("payout_release", "reoffer.withdraw", "POST", "/admin/reoffers/:reofferId/withdraw"),
  // Payout release and override
  a("payout_release", "payout.run-settlement", "POST", "/admin/payouts/run-settlement", "route"),
  a("payout_release", "payout.mark-paid", "POST", "/admin/payouts/:payoutId/mark-paid", "route"),
  a(
    "payout_release",
    "payout.retry-transfer",
    "POST",
    "/admin/payouts/:payoutId/retry-transfer",
    "route",
  ),
  a(
    "payout_override",
    "payout.adjustments",
    "POST",
    "/admin/payouts/:payoutId/adjustments",
    "route",
  ),
  a("payout_override", "payout.reverse", "POST", "/admin/payouts/:payoutId/reverse", "route"),
  // Roles and permissions
  a("role_permission", "user.role", "PATCH", "/admin/users/:userId/role"),
  a("role_permission", "user.staff-role", "PATCH", "/admin/users/:userId/staff-role"),
  a("role_permission", "user.bulk", "POST", "/admin/users/bulk"),
  a("role_permission", "user.suspend", "POST", "/admin/users/:userId/suspend"),
  a("role_permission", "user.unsuspend", "POST", "/admin/users/:userId/unsuspend"),
  a("role_permission", "staff.roles.add", "POST", "/admin/staff/:userId/roles"),
  a("role_permission", "staff.roles.remove", "POST", "/admin/staff/:userId/roles/remove"),
  a("role_permission", "staff.lax-admin-roles.add", "POST", "/admin/staff/:userId/lax-admin-roles"),
  a(
    "role_permission",
    "staff.lax-admin-roles.remove",
    "POST",
    "/admin/staff/:userId/lax-admin-roles/remove",
  ),
  a("role_permission", "invitation.create", "POST", "/admin/invitations"),
  a("role_permission", "invitation.bulk", "POST", "/admin/invitations/bulk"),
  a("role_permission", "impersonation.start", "POST", "/admin/impersonation/start"),
  a(
    "role_permission",
    "legal-entity.buyer-agent.grant",
    "POST",
    "/admin/legal-entities/:id/buyer-agent-authorisations",
  ),
  a(
    "role_permission",
    "legal-entity.buyer-agent.revoke",
    "POST",
    "/admin/legal-entities/:id/buyer-agent-authorisations/:authorisationId/revoke",
  ),
  // Sign-in protection of staff accounts
  a("sign_in_protection", "user.email-change", "POST", "/admin/users/:userId/email-change"),
  a(
    "sign_in_protection",
    "user.email-change-cancel",
    "POST",
    "/admin/users/:userId/email-change/cancel",
  ),
  a("sign_in_protection", "user.two-factor-reset", "POST", "/admin/users/:userId/two-factor/reset"),
  a(
    "sign_in_protection",
    "security.staff-two-factor-policy",
    "PUT",
    "/admin/security/staff-two-factor",
  ),
  // Collection hours, rules and closures: a change can cancel booked visits
  a("collection_settings", "collection.place.update", "PUT", "/admin/collections/:venueId"),
  a(
    "collection_settings",
    "collection.exception.add",
    "POST",
    "/admin/collections/:venueId/exceptions",
  ),
  a(
    "collection_settings",
    "collection.exception.remove",
    "POST",
    "/admin/collections/:venueId/exceptions/:exceptionId/remove",
  ),
  // Handing works over at the desk, undoing it, and marking a visit missed
  a(
    "collection_handover",
    "collection.hand-over",
    "POST",
    "/admin/collection-desk/bookings/:bookingId/hand-over",
  ),
  a(
    "collection_handover",
    "collection.hand-over-undo",
    "POST",
    "/admin/collection-desk/bookings/:bookingId/undo-hand-over",
  ),
  a(
    "collection_handover",
    "collection.not-collected",
    "POST",
    "/admin/collection-desk/bookings/:bookingId/not-collected",
  ),
  // Erasure and data-subject requests
  a(
    "erasure",
    "data-request.enquiry-erasure",
    "POST",
    "/admin/data-requests/:reference/enquiry-erasure",
  ),
  a("erasure", "data-request.close", "POST", "/admin/data-requests/:reference/close"),
  // KYC, AML and source-of-funds decisions
  a("kyc_sof_decision", "aml.decide", "POST", "/admin/compliance/aml/screenings/:id/decide"),
  a("kyc_sof_decision", "sof.decide", "POST", "/admin/compliance/source-of-funds/:id/decide"),
  a("kyc_sof_decision", "sof.reopen", "POST", "/admin/compliance/source-of-funds/:id/reopen"),
  a(
    "kyc_sof_decision",
    "sof.document-review",
    "POST",
    "/admin/compliance/source-of-funds/:id/documents/:docId/review",
  ),
  a("kyc_sof_decision", "legal-entity.approve", "POST", "/admin/legal-entities/:id/approve"),
  a("kyc_sof_decision", "legal-entity.reject", "POST", "/admin/legal-entities/:id/reject"),
  a("kyc_sof_decision", "legal-entity.archive", "POST", "/admin/legal-entities/:id/archive"),
  a("kyc_sof_decision", "legal-entity.restrict", "POST", "/admin/legal-entities/:id/restrict"),
  a(
    "kyc_sof_decision",
    "legal-entity.lift-restriction",
    "POST",
    "/admin/legal-entities/:id/lift-restriction",
  ),
  a(
    "kyc_sof_decision",
    "legal-entity.document-review",
    "POST",
    "/admin/legal-entities/:id/documents/:documentId/review",
  ),
  // Amounts that change what a buyer owes or may bid
  a(
    "amount_change",
    "registration.bid-limit",
    "PATCH",
    "/admin/sales/:saleId/registrations/:registrationId/bid-limit",
  ),
  a(
    "amount_change",
    "fulfilment.delivery-quote",
    "PUT",
    "/admin/lot-fulfilment/:lotId/delivery-quote",
  ),
  a(
    "amount_change",
    "telephone-booking.approve-limit-increase",
    "POST",
    "/admin/sales/:saleId/telephone-bookings/:bookingId/approve-limit-increase",
  ),
  a("goods_release", "fulfilment.release", "POST", "/admin/lot-fulfilment/:lotId/release"),
  // Personal data leaving the system
  a("personal_data_export", "export.create", "POST", "/exports", "route"),
  // Destructive catalogue actions (shared routes: sellers pass, staff need a recent sign-in)
  a("destructive_catalogue", "lot.delete", "POST", "/lots/:id/delete", "route"),
  a("destructive_catalogue", "lot.cancel", "POST", "/lots/:id/cancel", "route"),
  a("destructive_catalogue", "sale.delete", "POST", "/sales/:id/delete", "route"),
  a("destructive_catalogue", "sale.cancel", "POST", "/sales/:id/cancel", "route"),
];

/**
 * Left out on purpose, so nobody adds them by reflex:
 * - `POST /sales/:id/lots/:lotId/status`: routine catalogue operation, done many times a day;
 *   a sign-in prompt on each would train staff to click through it.
 * - The live saleroom hammer (`/admin/saleroom/...`): a prompt mid-sale would stop the auction
 *   and cost the room its bidders. Staff sign in before the sale and the session guards it.
 */

/**
 * Categories the audit named that have NO staff route in the Bid API yet. They are listed so a
 * route added later fails the registry test until it is registered.
 */
export const UNROUTED_DANGEROUS_CATEGORIES: ReadonlyMap<DangerousActionCategory, string> = new Map([
  [
    "invoice_void",
    "No staff route voids an invoice; Xero invoices are issued and settled by the finance runtime.",
  ],
]);

export const REQUIRED_DANGEROUS_CATEGORIES: readonly DangerousActionCategory[] = [
  "refund",
  "invoice_void",
  "payout_release",
  "payout_override",
  "role_permission",
  "erasure",
  "kyc_sof_decision",
  "amount_change",
  "sign_in_protection",
];

type Compiled = { action: DangerousStaffAction; pattern: RegExp };

const compiled: readonly Compiled[] = DANGEROUS_STAFF_ACTIONS.map((action) => ({
  action,
  pattern: new RegExp(`^${action.path.replace(/:[A-Za-z]+/g, "[^/]+")}/?$`),
}));

/** The registry entry a request falls under, or null when the action is not dangerous. */
export function findDangerousStaffAction(
  method: string,
  path: string,
): DangerousStaffAction | null {
  const verb = method.toUpperCase();
  for (const { action, pattern } of compiled) {
    if (action.method === verb && pattern.test(path)) return action;
  }
  return null;
}
