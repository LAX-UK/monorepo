import type { RoleCapability, UserStaffRole } from "@auction/types";

/**
 * The twelve Bid staff roles before the clean-up and what each could do, frozen as they were.
 * Only the clean-up migration report reads these; the application knows the current roles only.
 */
export const LEGACY_STAFF_ROLES = [
  "super_admin",
  "auction_manager",
  "catalogue_manager",
  "specialist",
  "finance_ops",
  "operations_fulfilment",
  "content_marketing",
  "support_concierge",
  "staff_viewer",
  "compliance_officer",
  "client_advisor",
  "operations",
] as const;
export type LegacyStaffRole = (typeof LEGACY_STAFF_ROLES)[number];

export const LEGACY_STAFF_ROLE_LABELS: Record<LegacyStaffRole, string> = {
  super_admin: "Super admin",
  auction_manager: "Auction manager",
  catalogue_manager: "Catalogue manager",
  specialist: "Specialist",
  finance_ops: "Finance",
  operations_fulfilment: "Operations fulfilment",
  content_marketing: "Content marketing",
  support_concierge: "Support concierge",
  staff_viewer: "Staff viewer",
  compliance_officer: "Compliance officer",
  client_advisor: "Client advisor",
  operations: "Operations",
};

/** A capability the clean-up removed, and the one that now opens what it used to open. */
export type RetiredCapability = "content.write";

const LEGACY_ADMINISTRATOR: readonly (RoleCapability | RetiredCapability)[] = [
  "platform.admin.full",
  "finance.read",
  "finance.platform.write",
  "finance.entity.write",
  "finance.write",
  "user.invite",
  "auction.manage",
  "legal_entity.read",
  "legal_entity.write",
  "legal_entity.approve",
  "legal_entity.archive",
  "artist.read",
  "artist.review",
  "artist.merge",
  "artist.delete",
  "payout.read",
  "payout.process",
  "payout.reverse",
  "audit.read_pii",
  "catalogue.write",
  "specialist.appraise",
  "operations.fulfilment",
  "content.write",
  "support.respond",
  "client.read",
  "bids.read",
  "aml.review",
  "compliance.mlro",
];

export const LEGACY_STAFF_ROLE_CAPABILITIES: Record<
  LegacyStaffRole,
  readonly (RoleCapability | RetiredCapability)[]
> = {
  super_admin: LEGACY_ADMINISTRATOR,
  auction_manager: ["auction.manage", "legal_entity.read", "legal_entity.write", "artist.read"],
  catalogue_manager: [
    "catalogue.write",
    "artist.read",
    "artist.review",
    "artist.delete",
    "legal_entity.read",
  ],
  specialist: ["specialist.appraise", "artist.read", "artist.review", "legal_entity.read"],
  finance_ops: [
    "finance.read",
    "finance.platform.write",
    "payout.read",
    "payout.process",
    "legal_entity.read",
  ],
  operations_fulfilment: ["operations.fulfilment", "legal_entity.read", "artist.read"],
  content_marketing: ["content.write", "artist.read"],
  support_concierge: ["support.respond", "legal_entity.read", "artist.read"],
  staff_viewer: ["legal_entity.read", "artist.read"],
  compliance_officer: ["aml.review", "compliance.mlro", "legal_entity.read", "audit.read_pii"],
  client_advisor: ["client.read", "bids.read", "legal_entity.read", "artist.read"],
  operations: [
    "catalogue.write",
    "auction.manage",
    "operations.fulfilment",
    "legal_entity.read",
    "artist.read",
    "client.read",
  ],
};

/**
 * Each previous role and the roles that replace it, the one screens show first. Mirrors the map
 * in migration 0242; a test keeps the two in step.
 */
export const STAFF_ROLE_SUCCESSORS: Record<LegacyStaffRole, readonly UserStaffRole[]> = {
  super_admin: ["administrator"],
  auction_manager: ["sales_manager"],
  catalogue_manager: ["cataloguer"],
  specialist: ["specialist"],
  finance_ops: ["finance"],
  operations_fulfilment: ["fulfilment"],
  compliance_officer: ["compliance"],
  operations: ["sales_manager", "cataloguer", "client_services", "fulfilment"],
  support_concierge: ["client_services"],
  client_advisor: ["client_services"],
  content_marketing: ["read_only"],
  staff_viewer: ["read_only"],
};

/**
 * `content.write` only ever opened the read-only email log in Bid; `admin.read` opens it now.
 * Holding the successor means nothing was lost.
 */
export const RETIRED_CAPABILITY_SUCCESSORS: Record<RetiredCapability, RoleCapability> = {
  "content.write": "admin.read",
};

const LEGACY_ROLE_SET = new Set<string>(LEGACY_STAFF_ROLES);

export function isLegacyStaffRole(role: string): role is LegacyStaffRole {
  return LEGACY_ROLE_SET.has(role);
}
