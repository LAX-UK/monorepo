import { LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, type UserStaffRole, userHasAccessTo } from "@auction/types";

export type CatalogLifecycleCapabilities = {
  canMutateSalesLifecycle: boolean;
  canMutateLotMembership: boolean;
  canMutateLotLifecycle: boolean;
};

export function resolveCatalogLifecycleCapabilities(input: {
  role: UserRole;
  staffRole: UserStaffRole | null;
}): CatalogLifecycleCapabilities {
  const canMutateSalesLifecycle = userHasAccessTo(input.role, input.staffRole, SALES_ACCESS);
  const canMutateLotMembership = userHasAccessTo(input.role, input.staffRole, LOTS_ACCESS);
  return {
    canMutateSalesLifecycle,
    canMutateLotMembership,
    canMutateLotLifecycle: canMutateSalesLifecycle || canMutateLotMembership,
  };
}
