import type { SessionUser } from "@/lib/data/contracts";
import {
  staffRoleFilterOptions,
  staffRoleLabel,
} from "@/lib/presenters/platform-role/platform-role-registry";
import { sessionUserToShellRole } from "@/lib/shell/session-user-shell-role";
import { type StaffRoles, normalizeStaffRoles } from "@auction/types";

export { staffRoleFilterOptions, staffRoleLabel };

const ROLE_LIST = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });

/**
 * Every role a person holds, for headers and badges: "Cataloguer and Fulfilment". Falls back to
 * "No staff role" for someone who holds none.
 */
export function staffRolesLabel(roles: StaffRoles | undefined): string {
  const held = normalizeStaffRoles(roles ?? []);
  if (held.length === 0) return "No staff role";
  return ROLE_LIST.format(held.map((role) => staffRoleLabel(role)));
}

/** Role label for shell identity chrome (sidebar pill, account menu). */
export function shellRolePillLabel(user: Pick<SessionUser, "role" | "staffRole">): string {
  const shell = sessionUserToShellRole(user);
  if (shell === "client") return "Client";
  if (user.role === "staff" && user.staffRole) {
    return staffRoleLabel(user.staffRole);
  }
  return "Staff";
}
