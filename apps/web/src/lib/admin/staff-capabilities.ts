import type { RoleCapability, StaffRoles } from "@auction/types";
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

/** What a set of staff roles may do together, for read-only admin display. */
export function listCapabilitiesForStaffRoles(staffRoles: StaffRoles): RoleCapability[] {
  return ALL_STAFF_CAPABILITIES.filter((cap) => roleHasCapability("staff", cap, staffRoles));
}
