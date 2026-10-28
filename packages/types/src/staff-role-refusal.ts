import type { LaxStaffAccessProduct } from "./domain-event-catalog/lax-staff-access-payload-schemas.js";
import { type LaxShopStaffRole, laxStaffRoleOption } from "./lax-staff-platforms.js";
import { LAX_ADMIN_ROLE_RULES } from "./role-policy/lax-admin-role-rules.js";
import {
  BID_STAFF_ROLE_RULES,
  type StaffRoleAssignmentRefusal,
} from "./role-policy/staff-role-assignment-rules.js";
import type { ForbiddenStaffRoleCombination } from "./role-policy/staff-role-rule-engine.js";
import type { UserStaffRole } from "./user.js";

/** "Saleroom clerk": a Bid staff role as people read it. */
export function bidStaffRoleLabel(role: UserStaffRole): string {
  return laxStaffRoleOption("bid", role)?.label ?? role;
}

/** "Catalogue editor": a role on any admin as people read it. */
export function staffRoleLabelOn(product: LaxStaffAccessProduct, role: string): string {
  return laxStaffRoleOption(product, role)?.label ?? role;
}

export type StaffRoleRefusalDetail<R extends string = UserStaffRole> = {
  readonly reason: StaffRoleAssignmentRefusal;
  readonly role: R;
  readonly conflictingRole?: R | undefined;
  /** The admin the role belongs to; Bid when absent. */
  readonly product?: LaxStaffAccessProduct | undefined;
};

function forbiddenRule(
  product: LaxStaffAccessProduct,
  a: string,
  b: string,
): ForbiddenStaffRoleCombination | null {
  return product === "shop"
    ? LAX_ADMIN_ROLE_RULES.forbiddenCombination(a as LaxShopStaffRole, b as LaxShopStaffRole)
    : BID_STAFF_ROLE_RULES.forbiddenCombination(a as UserStaffRole, b as UserStaffRole);
}

/**
 * Why a role change was refused, in one or two sentences for the person making it. The same
 * words appear before saving (the screens run the rule first) and in the API's refusal.
 */
export function staffRoleRefusalMessage<R extends string>(
  refusal: StaffRoleRefusalDetail<R>,
): string {
  const product = refusal.product ?? "bid";
  const role = staffRoleLabelOn(product, refusal.role);
  switch (refusal.reason) {
    case "duplicate":
      return `${role} is already one of their roles.`;
    case "forbidden_combination": {
      const other = refusal.conflictingRole;
      if (!other) return `${role} can't be combined with the roles they hold.`;
      const rule = forbiddenRule(product, refusal.role, other);
      const why = rule ? ` ${rule.why}` : "";
      return `${role} can't be combined with ${staffRoleLabelOn(product, other)}.${why}`;
    }
    case "last_administrator":
      return "They are the only administrator. Give someone else the administrator role first.";
    case "not_assigned":
      return `They no longer hold the ${role} role. Refresh the page to see their roles now.`;
    case "invalid_period":
      return "Choose an end date after today.";
  }
}
