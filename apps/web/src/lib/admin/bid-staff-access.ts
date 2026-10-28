import type { StaffAccess, StaffPermission } from "@auction/staff-ui";
import {
  type CapabilityRequirement,
  type RoleCapability,
  STAFF_CAPABILITIES,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";
import { staffRolesLabel } from "./staff-role-presenter";

const KNOWN_CAPABILITIES = new Set<string>(STAFF_CAPABILITIES);

const isCapability = (value: string): value is RoleCapability => KNOWN_CAPABILITIES.has(value);

/** The kit's permission as a Bid capability rule, or null when it names one Bid does not know. */
function asRequirement(permission: StaffPermission): CapabilityRequirement | null {
  if (typeof permission === "string") return isCapability(permission) ? permission : null;
  const anyOf = permission.anyOf.filter(isCapability);
  return anyOf.length === permission.anyOf.length ? { anyOf } : null;
}

/**
 * The signed-in person's Bid permissions for the staff kit: the same capability rules the API
 * checks, from the roles in force. A permission Bid does not know is refused, never assumed.
 */
export function bidStaffAccess(role: UserRole, staffRoles: StaffRoles | undefined): StaffAccess {
  return {
    can: (permission) => {
      const requirement = asRequirement(permission);
      return requirement !== null && userHasAccessTo(role, staffRoles, requirement);
    },
    roleLabel: role === "staff" ? staffRolesLabel(staffRoles) : undefined,
  };
}
