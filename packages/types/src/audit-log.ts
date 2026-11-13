/**
 * Views of the staff audit log. Each view is a set of event-type prefixes, so the API filters by
 * view and the web app labels it from the same list.
 */

export const AUDIT_LOG_VIEW_IDS = ["finance", "catalogue", "people", "operations"] as const;
export type AuditLogView = (typeof AUDIT_LOG_VIEW_IDS)[number];

export const AUDIT_LOG_VIEW_PREFIXES: Readonly<Record<AuditLogView, readonly string[]>> = {
  finance: [
    "invoice.",
    "payment.",
    "payment_group.",
    "dispute_case.",
    "purchase_problem.",
    "payout.",
    "xero.",
    "shop.refund.",
    "shop.payout.",
    "shop.dispute.",
    "shop.sale_fee.",
    "private_sale_deal.",
  ],
  catalogue: [
    "lot.",
    "sale.",
    "artist.",
    "artwork_register.",
    "category.",
    "venue.",
    "condition_report.",
    "item_submission.",
    "saleroom.",
  ],
  people: [
    "auth.",
    "user.",
    "subject.",
    "kyc.",
    "aml.",
    "source_of_funds.",
    "legal_entity.",
    "sale_registration.",
    "email.",
    "lax.staff_access.",
    "staff.role_",
    "admin.impersonation_",
    "bid.user_suspended",
    "bid.user_anonymised",
    "shop.user_anonymised",
    "data_request.",
  ],
  operations: ["failed_job.", "marketing_enquiry.", "enquiry_routing.", "collection."],
};

export function isAuditLogView(value: string): value is AuditLogView {
  return (AUDIT_LOG_VIEW_IDS as readonly string[]).includes(value);
}
