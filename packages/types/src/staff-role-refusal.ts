import { laxStaffRoleOption } from "./lax-staff-platforms.js";
import {
  type StaffRoleAssignmentRefusal,
  forbiddenStaffRoleCombination,
} from "./role-policy/staff-role-assignment-rules.js";
import type { UserStaffRole } from "./user.js";

/** "Saleroom clerk": a Bid staff role as people read it. */
export function bidStaffRoleLabel(role: UserStaffRole): string {
  return laxStaffRoleOption("bid", role)?.label ?? role;
}

export type StaffRoleRefusalDetail = {
  readonly reason: StaffRoleAssignmentRefusal;
  readonly role: UserStaffRole;
  readonly conflictingRole?: UserStaffRole | undefined;
};

/**
 * Why a role change was refused, in one or two sentences for the person making it. The same
 * words appear before saving (the screens run the rule first) and in the API's refusal.
 */
export function staffRoleRefusalMessage(refusal: StaffRoleRefusalDetail): string {
  const role = bidStaffRoleLabel(refusal.role);
  switch (refusal.reason) {
    case "duplicate":
      return `${role} is already one of their roles.`;
    case "forbidden_combination": {
      const other = refusal.conflictingRole;
      if (!other) return `${role} can't be combined with the roles they hold.`;
      const rule = forbiddenStaffRoleCombination(refusal.role, other);
      const why = rule ? ` ${rule.why}` : "";
      return `${role} can't be combined with ${bidStaffRoleLabel(other)}.${why}`;
    }
    case "last_administrator":
      return "They are the only administrator. Give someone else the administrator role first.";
    case "not_assigned":
      return `They no longer hold the ${role} role. Refresh the page to see their roles now.`;
    case "invalid_period":
      return "Choose an end date after today.";
  }
}
