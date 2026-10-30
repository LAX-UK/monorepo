/**
 * Views of the staff audit log. Each view is a set of event-type prefixes, so the API filters by
 * view and the web app labels it from the same list.
 */

export const AUDIT_LOG_VIEW_IDS = ["finance", "catalogue", "people"] as const;
export type AuditLogView = (typeof AUDIT_LOG_VIEW_IDS)[number];

export const AUDIT_LOG_VIEW_PREFIXES: Readonly<Record<AuditLogView, readonly string[]>> = {
  finance: [
    "payment.",
    "payment_group.",
    "payout.",
    "xero.",
    "shop.refund.",
    "shop.payout.",
    "shop.dispute.",
    "shop.sale_fee.",
  ],
  catalogue: [
    "lot.",
    "sale.",
    "artist.",
    "category.",
    "venue.",
    "condition_report.",
    "item_submission.",
    "saleroom.",
  ],
  people: [
    "auth.",
    "user.",
    "kyc.",
    "aml.",
    "source_of_funds.",
    "legal_entity.",
    "lax.staff_access.",
    "staff.role_",
    "admin.impersonation_",
    "bid.user_suspended",
  ],
};

export function isAuditLogView(value: string): value is AuditLogView {
  return (AUDIT_LOG_VIEW_IDS as readonly string[]).includes(value);
}
