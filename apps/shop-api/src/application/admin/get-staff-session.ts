import type { ShopStaffRole } from "@auction/shop-domain";
import { capabilitiesForRole } from "@auction/shop-domain";
import type { ShopFeatureFlagsReader } from "../ports/shop-feature-flags.js";

export type StaffSessionView = {
  subject: string;
  role: ShopStaffRole;
  capabilities: readonly string[];
  features: ReturnType<ShopFeatureFlagsReader["read"]>;
};

export function getStaffSessionView(input: {
  subject: string;
  role: ShopStaffRole;
  featureFlags: ShopFeatureFlagsReader;
}): StaffSessionView {
  return {
    subject: input.subject,
    role: input.role,
    capabilities: [...capabilitiesForRole(input.role)],
    features: input.featureFlags.read(),
  };
}
