import { type UserStaffRole, userStaffRoles } from "../user.js";
import type { RoleCapability } from "./role-capability.js";

/** Every staff capability; client-only ones (`bid.place`, `client.submit`) are never granted to staff. */
export const STAFF_CAPABILITIES: readonly RoleCapability[] = [
  "platform.admin.full",
  "finance.read",
  "finance.platform.write",
  "finance.entity.write",
  "finance.write",
  "user.invite",
  "auction.manage",
  "saleroom.operate",
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
  "support.respond",
  "client.read",
  "bids.read",
  "aml.review",
  "compliance.mlro",
  "admin.read",
];

/**
 * What each Bid staff role may do, one row per job. A person's permissions are the union over the
 * roles they hold. Adding a role is one row here and one in `userStaffRoles`; permissions
 * not listed under a working role (reversing payouts, approving or archiving organisations,
 * merging artists, inviting staff and assigning roles) stay with the administrator.
 */
const STAFF_MATRIX: Record<UserStaffRole, ReadonlySet<RoleCapability>> = {
  administrator: new Set(STAFF_CAPABILITIES),
  sales_manager: new Set([
    "auction.manage",
    "legal_entity.read",
    "legal_entity.write",
    "artist.read",
  ]),
  saleroom_clerk: new Set(["saleroom.operate", "bids.read", "legal_entity.read"]),
  cataloguer: new Set([
    "catalogue.write",
    "artist.read",
    "artist.review",
    "artist.delete",
    "legal_entity.read",
  ]),
  specialist: new Set(["specialist.appraise", "artist.read", "artist.review", "legal_entity.read"]),
  client_services: new Set([
    "client.read",
    "bids.read",
    "support.respond",
    "legal_entity.read",
    "artist.read",
  ]),
  finance: new Set([
    "finance.read",
    "finance.platform.write",
    "payout.read",
    "payout.process",
    "legal_entity.read",
  ]),
  fulfilment: new Set(["operations.fulfilment", "legal_entity.read", "artist.read"]),
  // Reads personal data on screening records (audit.read_pii) for the cases it decides.
  compliance: new Set(["aml.review", "compliance.mlro", "legal_entity.read", "audit.read_pii"]),
  // Organisations and artists were readable to the staff viewer before admin.read existed; they
  // stay explicit so the role keeps every read it had.
  read_only: new Set(["admin.read", "legal_entity.read", "artist.read"]),
};

export function staffRoleCapabilities(role: UserStaffRole): ReadonlySet<RoleCapability> {
  return STAFF_MATRIX[role];
}

/** Every staff role that grants at least one of `capabilities`, in canonical role order. */
export function staffRolesGranting(capabilities: readonly RoleCapability[]): UserStaffRole[] {
  return userStaffRoles.filter((role) =>
    capabilities.some((capability) => STAFF_MATRIX[role].has(capability)),
  );
}
