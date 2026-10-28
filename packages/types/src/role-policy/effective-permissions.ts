import type { RoleCapability } from "./role-capability.js";
import { staffRoleCapabilities } from "./staff-capability-matrix.js";
import { type StaffRoleAssignment, activeStaffRoles } from "./staff-role-assignment.js";
import type { StaffRoles } from "./staff-roles.js";

/** Union of what each held role may do. No roles, no capabilities. */
export function staffRolesCapabilities(roles: StaffRoles): ReadonlySet<RoleCapability> {
  const capabilities = new Set<RoleCapability>();
  for (const role of roles) {
    for (const capability of staffRoleCapabilities(role)) capabilities.add(capability);
  }
  return capabilities;
}

/**
 * A staff member's permissions at `now`: the union of the roles in force. A role that has ended
 * or has not started yet adds nothing.
 */
export function effectivePermissions(
  assignments: readonly StaffRoleAssignment[],
  now: Date,
): ReadonlySet<RoleCapability> {
  return staffRolesCapabilities(activeStaffRoles(assignments, now));
}
