import type { UserRole, UserStaffRole } from "@auction/types";
import { viewerCanSeeNonPublicCatalog } from "@auction/validators";

/** Staff may edit catalogue media and related entities (matches upload presign policy). */
export function canManageCatalogue(
  role: UserRole,
  staffRole?: UserStaffRole | string | null,
): boolean {
  return viewerCanSeeNonPublicCatalog(role, staffRole);
}
