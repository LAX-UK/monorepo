import type { RoleCapability, UserStaffRole } from "@auction/types";
import { roleHasCapability } from "@auction/types";

const ALL_STAFF_CAPABILITIES: RoleCapability[] = [
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
  "payout.read",
  "payout.process",
  "payout.reverse",
  "audit.read_pii",
  "catalogue.write",
  "specialist.appraise",
  "operations.fulfilment",
  "content.write",
  "support.respond",
];

/** Capabilities granted to a staff user for read-only admin display. */
export function listCapabilitiesForStaffRole(staffRole: UserStaffRole | null): RoleCapability[] {
  if (staffRole == null) return [];
  return ALL_STAFF_CAPABILITIES.filter((cap) => roleHasCapability("staff", cap, staffRole));
}
