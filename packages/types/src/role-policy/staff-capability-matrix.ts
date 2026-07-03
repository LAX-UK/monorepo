import type { UserStaffRole } from "../user.js";
import type { RoleCapability } from "./role-capabilities.js";

const ALL_STAFF_CAPABILITIES_EXCEPT_CLIENT: RoleCapability[] = [
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

const SUPER_ADMIN_CAPS = new Set<RoleCapability>(ALL_STAFF_CAPABILITIES_EXCEPT_CLIENT);

const STAFF_MATRIX: Record<Exclude<UserStaffRole, "super_admin">, Set<RoleCapability>> = {
  auction_manager: new Set([
    "auction.manage",
    "legal_entity.read",
    "legal_entity.write",
    "artist.read",
  ]),
  catalogue_manager: new Set([
    "catalogue.write",
    "artist.read",
    "artist.review",
    "artist.delete",
    "legal_entity.read",
  ]),
  specialist: new Set(["specialist.appraise", "artist.read", "artist.review", "legal_entity.read"]),
  finance_ops: new Set([
    "finance.read",
    "finance.platform.write",
    "payout.read",
    "payout.process",
    "legal_entity.read",
  ]),
  operations_fulfilment: new Set(["operations.fulfilment", "legal_entity.read", "artist.read"]),
  content_marketing: new Set(["content.write", "artist.read"]),
  support_concierge: new Set(["support.respond", "legal_entity.read", "artist.read"]),
  staff_viewer: new Set(["legal_entity.read", "artist.read"]),
  // MLRO / compliance officer: AML review + Source-of-Funds disposition. Reads
  // PII on screening records (audit.read_pii) and the user directory it relates to.
  compliance_officer: new Set([
    "aml.review",
    "compliance.mlro",
    "legal_entity.read",
    "audit.read_pii",
  ]),
  client_advisor: new Set(["client.read", "bids.read", "legal_entity.read", "artist.read"]),
  operations: new Set([
    "catalogue.write",
    "auction.manage",
    "operations.fulfilment",
    "legal_entity.read",
    "artist.read",
    "client.read",
  ]),
};

export function staffRoleHasCapability(staff: UserStaffRole, capability: RoleCapability): boolean {
  if (staff === "super_admin") return SUPER_ADMIN_CAPS.has(capability);
  return STAFF_MATRIX[staff].has(capability);
}
