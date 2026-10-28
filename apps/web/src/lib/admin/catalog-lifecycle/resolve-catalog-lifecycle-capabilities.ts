import { LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type StaffRoles, type UserRole, userHasAccessTo } from "@auction/types";

export type CatalogLifecycleCapabilities = {
  canMutateSalesLifecycle: boolean;
  canMutateLotMembership: boolean;
  canMutateLotLifecycle: boolean;
};

export function resolveCatalogLifecycleCapabilities(input: {
  role: UserRole;
  staffRoles: StaffRoles | undefined;
}): CatalogLifecycleCapabilities {
  const canMutateSalesLifecycle = userHasAccessTo(input.role, input.staffRoles, SALES_ACCESS);
  const canMutateLotMembership = userHasAccessTo(input.role, input.staffRoles, LOTS_ACCESS);
  return {
    canMutateSalesLifecycle,
    canMutateLotMembership,
    canMutateLotLifecycle: canMutateSalesLifecycle || canMutateLotMembership,
  };
}
