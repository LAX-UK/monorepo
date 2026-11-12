import {
  staffRoleFilterOptions,
  staffRoleLabel,
} from "@/lib/presenters/platform-role/platform-role-registry";
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
