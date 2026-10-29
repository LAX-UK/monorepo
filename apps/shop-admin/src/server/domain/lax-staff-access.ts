import { SHOP_STAFF_CAPABILITIES } from "@auction/shop-domain";
import type { StaffAccess, StaffPermission } from "@auction/staff-ui";

const KNOWN = new Set<string>(SHOP_STAFF_CAPABILITIES);

/**
 * The signed-in person's LAX Admin permissions for the staff kit: the capabilities the session
 * says their roles give together, which are what shop-api checks. A permission LAX Admin does
 * not know is refused, never assumed.
 */
export function laxStaffAccess(
  capabilities: readonly string[],
  roleLabel: string | undefined,
): StaffAccess {
  const held = new Set(capabilities.filter((c) => KNOWN.has(c)));
  const can = (permission: StaffPermission): boolean =>
    typeof permission === "string"
      ? held.has(permission)
      : permission.anyOf.some((capability) => held.has(capability));
  return { can, roleLabel };
}
