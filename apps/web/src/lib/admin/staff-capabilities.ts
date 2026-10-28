import type { RoleCapability, StaffRoles } from "@auction/types";
import { STAFF_CAPABILITIES, roleHasCapability } from "@auction/types";

/** What a set of staff roles may do together, for read-only admin display. */
export function listCapabilitiesForStaffRoles(staffRoles: StaffRoles): RoleCapability[] {
  return STAFF_CAPABILITIES.filter((cap) => roleHasCapability("staff", cap, staffRoles));
}
