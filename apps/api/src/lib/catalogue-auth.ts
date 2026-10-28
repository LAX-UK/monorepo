import type { StaffRoles, UserRole } from "@auction/types";
import { viewerCanSeeNonPublicCatalog } from "@auction/validators";

/** Staff may edit catalogue media and related entities (matches upload presign policy). */
export function canManageCatalogue(role: UserRole, staffRoles?: StaffRoles | undefined): boolean {
  return viewerCanSeeNonPublicCatalog(role, staffRoles);
}
