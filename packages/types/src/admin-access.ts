import { type CapabilityRequirement, requirementCapabilities } from "./role-policy.js";

/**
 * The read rule for a page whose write rule is `write`: anyone who may change what the page shows
 * may open it, and so may anyone holding `admin.read`. The write rule still guards every action.
 */
export function readOrWrite(write: CapabilityRequirement): CapabilityRequirement {
  return { anyOf: [...requirementCapabilities(write), "admin.read"] };
}

/** Minimum access to show the staff admin home link in the shell. */
export const STAFF_OVERVIEW_ACCESS: CapabilityRequirement = {
  anyOf: [
    "auction.manage",
    "saleroom.operate",
    "catalogue.write",
    "specialist.appraise",
    "operations.fulfilment",
    "support.respond",
    "finance.read",
    "platform.admin.full",
    "legal_entity.read",
    "artist.read",
    "client.read",
    "aml.review",
    "admin.read",
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
export const SUBMISSIONS_READ_ACCESS: CapabilityRequirement = readOrWrite(SUBMISSIONS_ACCESS);

/**
 * Consignment messages in Bid admin. Answering a client, assigning a thread and closing it belong
 * to the people who own the client relationship: specialists, client services, sales managers and
 * administrators.
 */
export const CONSIGNMENT_INBOX_REPLY_ACCESS: CapabilityRequirement = {
  anyOf: ["specialist.appraise", "support.respond", "auction.manage", "platform.admin.full"],
};

/**
 * Reading the inbox and its threads: everyone who replies, plus the teams who need the context
 * (cataloguing, finance, compliance, fulfilment) and read-only staff. The saleroom clerk holds
 * none of these, so never sees client messages.
 */
export const CONSIGNMENT_INBOX_READ_ACCESS: CapabilityRequirement = {
  anyOf: [
    ...requirementCapabilities(CONSIGNMENT_INBOX_REPLY_ACCESS),
    "catalogue.write",
    "finance.read",
    "aml.review",
    "operations.fulfilment",
    "admin.read",
  ],
};

/** The team's saved replies are written and retired by sales managers and administrators. */
export const CONSIGNMENT_SAVED_REPLIES_MANAGE_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "platform.admin.full"],
};

export const CONDITION_REPORTS_ACCESS: CapabilityRequirement = {
  anyOf: ["catalogue.write", "specialist.appraise", "platform.admin.full"],
};
export const CONDITION_REPORTS_READ_ACCESS: CapabilityRequirement =
  readOrWrite(CONDITION_REPORTS_ACCESS);

export const LOTS_ACCESS: CapabilityRequirement = {
  anyOf: ["catalogue.write", "auction.manage", "platform.admin.full"],
};
export const LOTS_READ_ACCESS: CapabilityRequirement = readOrWrite(LOTS_ACCESS);

export const SALES_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "platform.admin.full"],
};
export const SALES_READ_ACCESS: CapabilityRequirement = readOrWrite(SALES_ACCESS);

/** View draft sales and work on catalog prep / lots in sale setup. */
export const SALE_CATALOG_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "catalogue.write", "platform.admin.full"],
};
export const SALE_CATALOG_READ_ACCESS: CapabilityRequirement = readOrWrite(SALE_CATALOG_ACCESS);

/** Change catalogue records (sales, lots, media). Matches the catalogue upload policy. */
export const CATALOGUE_WRITE_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "catalogue.write"],
};
/** See catalogue records that are not public yet (drafts, withdrawn, admin detail). */
export const CATALOGUE_READ_ACCESS: CapabilityRequirement = readOrWrite(CATALOGUE_WRITE_ACCESS);

/**
 * A sale's admin record with its lots: catalogue readers, and the saleroom, whose console is
 * built on it.
 */
export const SALE_ADMIN_DETAIL_ACCESS: CapabilityRequirement = {
  anyOf: [...requirementCapabilities(CATALOGUE_READ_ACCESS), "saleroom.operate"],
};

/** Lot documents, lifecycle and the staff lot browser. */
export const LOT_WORK_ACCESS: CapabilityRequirement = {
  anyOf: ["specialist.appraise", "catalogue.write", "auction.manage"],
};
export const LOT_WORK_READ_ACCESS: CapabilityRequirement = readOrWrite(LOT_WORK_ACCESS);

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
export const CATEGORIES_READ_ACCESS: CapabilityRequirement = readOrWrite(CATEGORIES_ACCESS);

export const VENUES_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "catalogue.write", "platform.admin.full"],
};
export const VENUES_READ_ACCESS: CapabilityRequirement = readOrWrite(VENUES_ACCESS);

/**
 * The live saleroom: its pages and its actions (telephone bids, paddles, check-in). A saleroom
 * clerk runs it without `auction.manage`, so cannot edit sales.
 */
export const SALEROOM_ACCESS: CapabilityRequirement = {
  anyOf: ["auction.manage", "saleroom.operate", "platform.admin.full"],
};

export const LOT_FULFILMENT_ACCESS: CapabilityRequirement = {
  anyOf: ["operations.fulfilment", "platform.admin.full"],
};

/** Finance shell: payments, disputes, payouts, integrations. */
export const FINANCE_ACCESS: CapabilityRequirement = "finance.read";

/**
 * Capture and refund a payment from the admin payments screens. Finance holds
 * `finance.platform.write`; the administrator also holds `finance.entity.write`. The API route
 * additionally lets a seller entity's own finance members act on their own payments.
 */
export const PAYMENT_WRITE_ACCESS: CapabilityRequirement = {
  anyOf: ["finance.platform.write", "finance.entity.write"],
};

/**
 * Release or refund a payment held for manual review. Platform-wide finance write only:
 * a held payment is not yet any seller entity's to act on.
 */
export const PAYMENT_MANUAL_REVIEW_WRITE_ACCESS: CapabilityRequirement = "finance.platform.write";

/**
 * Allocate a card dispute to the invoices it falls on. It moves each seller's payout, so it is
 * platform-wide finance write, like releasing or refunding a held payment.
 */
export const DISPUTE_ALLOCATION_WRITE_ACCESS: CapabilityRequirement = "finance.platform.write";

/**
 * Approve or decline a seller's request to withdraw a lot. Withdrawing cancels the lot and
 * can pull it out of a sale, so it follows `auction.manage`, not the wider catalogue access.
 */
export const WITHDRAWAL_DECISION_ACCESS: CapabilityRequirement = "auction.manage";

/**
 * Replay a dead-lettered domain-event delivery or retry a webhook. These re-run side effects
 * (emails, ledger writes), so they are an operations action, not an audit read.
 */
export const DELIVERY_REPLAY_ACCESS: CapabilityRequirement = "platform.admin.full";

export const PAYOUT_PROCESS_ACCESS: CapabilityRequirement = {
  anyOf: ["payout.process", "platform.admin.full"],
};

export const PAYOUT_REVERSE_ACCESS: CapabilityRequirement = {
  anyOf: ["payout.reverse", "platform.admin.full"],
};

/** QR code list/read on lot and sale detail pages. */
export const QR_CODES_ACCESS: CapabilityRequirement = LOTS_ACCESS;
export const QR_CODES_READ_ACCESS: CapabilityRequirement = LOTS_READ_ACCESS;

/** Admin home dashboard and widget preferences. */
export const ADMIN_HOME_ACCESS: CapabilityRequirement = STAFF_OVERVIEW_ACCESS;

/** Full platform administration (clients, staff, impersonation). */
export const PLATFORM_ADMIN_ACCESS: CapabilityRequirement = "platform.admin.full";

/** Redacted domain-event audit feeds (PII still gated per-request). */
export const AUDIT_DOMAIN_EVENTS_ACCESS: CapabilityRequirement = ADMIN_DASHBOARD_ACCESS;

/** Email outbox, events, and suppression management (mutations). */
export const EMAIL_ADMIN_ACCESS: CapabilityRequirement = PLATFORM_ADMIN_ACCESS;

/** Read-only email outbox, events, and suppression list (no mutations). */
export const EMAIL_OBSERVABILITY_ACCESS: CapabilityRequirement = readOrWrite(EMAIL_ADMIN_ACCESS);

/** Client/staff directory list and detail reads. */
export const USERS_DIRECTORY_ACCESS: CapabilityRequirement = {
  anyOf: ["platform.admin.full", "client.read"],
};

/** Per-client bid transaction history in admin. */
export const CLIENT_BIDS_ACCESS: CapabilityRequirement = {
  anyOf: ["platform.admin.full", "bids.read"],
};

/**
 * KYC verification sessions expose identity PII (name, DOB, ID number, nationality).
 * Deliberately decoupled from {@link USERS_DIRECTORY_ACCESS} so relaxing directory
 * reads (e.g. for client services) never leaks PII. Platform admin only.
 */
export const CLIENT_KYC_ACCESS: CapabilityRequirement = PLATFORM_ADMIN_ACCESS;

/**
 * Session / IP activity history. Decoupled from {@link USERS_DIRECTORY_ACCESS}
 * for the same least-privilege reason as {@link CLIENT_KYC_ACCESS}. Platform admin only.
 */
export const CLIENT_ACTIVITY_ACCESS: CapabilityRequirement = PLATFORM_ADMIN_ACCESS;

/** Onboarding & verification queues. */
export const ONBOARDING_QUEUES_ACCESS: CapabilityRequirement = STAFF_OVERVIEW_ACCESS;

/** Invitations list and mutations. */
export const INVITATIONS_ACCESS: CapabilityRequirement = {
  anyOf: ["platform.admin.full", "user.invite"],
};

/** Set client/staff role and staff-role assignments (API uses user.invite). */
export const USER_ROLE_MANAGEMENT_ACCESS: CapabilityRequirement = INVITATIONS_ACCESS;

/**
 * The access review: every staff member's roles and when each ends. Those who manage roles use
 * it to act; read-only staff (auditors) see it without the actions.
 */
export const STAFF_ACCESS_REVIEW_ACCESS: CapabilityRequirement = readOrWrite(
  USER_ROLE_MANAGEMENT_ACCESS,
);

/** One person's role assignments: on their staff record and in the access review. */
export const STAFF_ROLES_READ_ACCESS: CapabilityRequirement = {
  anyOf: [
    ...new Set([
      ...requirementCapabilities(USERS_DIRECTORY_ACCESS),
      ...requirementCapabilities(STAFF_ACCESS_REVIEW_ACCESS),
    ]),
  ],
};

/** Moving a legal entity through its compliance lifecycle (restrict, lift a restriction). */
export const LEGAL_ENTITY_WRITE_ACCESS: CapabilityRequirement = "legal_entity.write";

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
