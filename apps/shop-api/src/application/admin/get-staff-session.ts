import type { ShopStaffCapability, ShopStaffRole } from "@auction/shop-domain";
import { SHOP_STAFF_CAPABILITIES } from "@auction/shop-domain";
import { primaryLaxAdminRole } from "@auction/types";
import type { ShopFeatureFlagsReader } from "../ports/shop-feature-flags.js";

export type StaffSessionView = {
  subject: string;
  /** The primary role, for places with room for one. */
  role: ShopStaffRole;
  /** Every role in force, in role order. */
  roles: ShopStaffRole[];
  /** The union of the roles' capabilities, in catalogue order. */
  capabilities: ShopStaffCapability[];
  features: ReturnType<ShopFeatureFlagsReader["read"]>;
};

export function getStaffSessionView(input: {
  subject: string;
  roles: readonly ShopStaffRole[];
  capabilities: ReadonlySet<ShopStaffCapability>;
  featureFlags: ShopFeatureFlagsReader;
}): StaffSessionView {
  const role = primaryLaxAdminRole(input.roles);
  if (!role) throw new Error("A staff session needs at least one role in force");
  return {
    subject: input.subject,
    role,
    roles: [...input.roles],
    capabilities: SHOP_STAFF_CAPABILITIES.filter((c) => input.capabilities.has(c)),
    features: input.featureFlags.read(),
  };
}
