import type { CapabilityRequirement } from "./role-policy.js";

/** Minimum access to show the staff admin home link in the shell. */
export const STAFF_OVERVIEW_ACCESS: CapabilityRequirement = {
  anyOf: [
    "auction.manage",
    "catalogue.write",
    "specialist.appraise",
    "operations.fulfilment",
    "content.write",
    "support.respond",
    "finance.read",
    "platform.admin.full",
    "legal_entity.read",
    "artist.read",
    "aml.review",
  ],
};

/** AML / sanctions watchlist queue + first-line analyst triage; SoF list/triage. */
export const AML_REVIEW_ACCESS: CapabilityRequirement = {
  anyOf: ["aml.review", "compliance.mlro", "platform.admin.full"],
};

/**
 * Binding MLRO decision (checker) on a flagged screening or SoF case. Distinct
 * from `AML_REVIEW_ACCESS` so maker-checker can separate first-line triage from
 * the final clear/block decision.
 */
export const MLRO_DECISION_ACCESS: CapabilityRequirement = {
  anyOf: ["compliance.mlro", "platform.admin.full"],
};

/** Admin dashboard widgets (attention feed, live metrics). */
export const ADMIN_DASHBOARD_ACCESS: CapabilityRequirement = STAFF_OVERVIEW_ACCESS;

export const SUBMISSIONS_ACCESS: CapabilityRequirement = {
  anyOf: ["specialist.appraise", "catalogue.write", "auction.manage"],
};

export const CONDITION_REPORTS_ACCESS: CapabilityRequirement = {
  anyOf: ["catalogue.write", "specialist.appraise", "platform.admin.full"],
};

export const LOTS_ACCESS: CapabilityRequirement = {
  anyOf: ["catalogue.write", "auction.manage", "platform.admin.full"],
};

export const SALES_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "platform.admin.full"],
};

/** View draft sales and work on catalog prep / lots in sale setup. */
export const SALE_CATALOG_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "catalogue.write", "platform.admin.full"],
};

export const ARTISTS_ACCESS: CapabilityRequirement = {
  anyOf: ["artist.read", "artist.review", "catalogue.write", "platform.admin.full"],
};

export const ARTIST_WRITE_ACCESS: CapabilityRequirement = {
  anyOf: ["catalogue.write", "artist.review", "artist.merge", "platform.admin.full"],
};

export const ARTIST_REVIEW_ACCESS: CapabilityRequirement = {
  anyOf: ["artist.review", "platform.admin.full"],
};

export const ARTIST_MERGE_ACCESS: CapabilityRequirement = {
  anyOf: ["artist.merge", "platform.admin.full"],
};

export const ARTIST_DELETE_ACCESS: CapabilityRequirement = {
  anyOf: ["artist.delete", "platform.admin.full"],
};

export const CATEGORIES_ACCESS: CapabilityRequirement = {
  anyOf: ["catalogue.write", "platform.admin.full"],
};

export const VENUES_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "catalogue.write", "platform.admin.full"],
};

export const SALEROOM_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "platform.admin.full"],
};

export const CONVEYOR_ACCESS: CapabilityRequirement = {
  anyOf: ["operations.fulfilment", "platform.admin.full"],
};

export const LOT_FULFILMENT_ACCESS: CapabilityRequirement = {
  anyOf: ["operations.fulfilment", "platform.admin.full"],
};

/** Finance shell: payments, disputes, payouts, integrations. */
export const FINANCE_ACCESS: CapabilityRequirement = "finance.read";

export const PAYOUT_REVERSE_ACCESS: CapabilityRequirement = {
  anyOf: ["payout.reverse", "platform.admin.full"],
};

/** QR code list/read on lot and sale detail pages. */
export const QR_CODES_ACCESS: CapabilityRequirement = LOTS_ACCESS;

/** Admin home dashboard and widget preferences. */
export const ADMIN_HOME_ACCESS: CapabilityRequirement = STAFF_OVERVIEW_ACCESS;

/** Full platform administration (clients, staff, impersonation, analytics). */
export const PLATFORM_ADMIN_ACCESS: CapabilityRequirement = "platform.admin.full";

/** Redacted domain-event audit feeds (PII still gated per-request). */
export const AUDIT_DOMAIN_EVENTS_ACCESS: CapabilityRequirement = ADMIN_DASHBOARD_ACCESS;

/** Email outbox, events, and suppression management. */
export const EMAIL_ADMIN_ACCESS: CapabilityRequirement = PLATFORM_ADMIN_ACCESS;

/** Client/staff directory list and detail reads. */
export const USERS_DIRECTORY_ACCESS: CapabilityRequirement = PLATFORM_ADMIN_ACCESS;

export const ANALYTICS_ACCESS: CapabilityRequirement = PLATFORM_ADMIN_ACCESS;

/** Onboarding & verification queues. */
export const ONBOARDING_QUEUES_ACCESS: CapabilityRequirement = STAFF_OVERVIEW_ACCESS;

/** Invitations list and mutations. */
export const INVITATIONS_ACCESS: CapabilityRequirement = {
  anyOf: ["platform.admin.full", "user.invite"],
};

/** Set client/staff role and staff-role assignments (API uses user.invite). */
export const USER_ROLE_MANAGEMENT_ACCESS: CapabilityRequirement = INVITATIONS_ACCESS;

/** Legal entity browse and read-only admin views. */
export const LEGAL_ENTITY_BROWSE_ACCESS: CapabilityRequirement = "legal_entity.read";

/** Narrower access for user pickers in catalog/forms (not full directory). */
export const USER_PICKER_ACCESS: CapabilityRequirement = {
  anyOf: ["catalogue.write", "artist.review", "platform.admin.full"],
};

/** Suspend, unsuspend, and bulk user moderation. */
export const USER_MODERATION_ACCESS: CapabilityRequirement = {
  anyOf: ["platform.admin.full", "support.respond"],
};

/** Legal entity picker in admin forms. */
export const LEGAL_ENTITY_PICKER_ACCESS: CapabilityRequirement = {
  anyOf: ["legal_entity.read", "catalogue.write", "auction.manage", "platform.admin.full"],
};
