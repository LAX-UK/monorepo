import {
  type UserRole,
  type UserStaffRole,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";

/** Staff may edit catalogue media and related entities (matches upload presign policy). */
export function canManageCatalogue(
  role: UserRole,
  staffRole?: UserStaffRole | string | null,
): boolean {
  const staff = normalizeUserStaffRole(staffRole ?? undefined);
  return (
    roleHasCapability(role, "auction.manage", staff) ||
    roleHasCapability(role, "catalogue.write", staff)
  );
}
