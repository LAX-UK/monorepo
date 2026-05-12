import { getAdminNavGroups } from "@/components/layout/admin-nav-groups";
import type { NavItem } from "@/lib/navigation/nav-types";
import type { UserRole, UserStaffRole } from "@auction/types";

/** Flat list for command palette / consumers that need a single array */
export function getAdminNavItems(
  role: UserRole,
  pendingSubmissionCount: number,
  staffRole?: UserStaffRole | null,
): readonly NavItem[] {
  return getAdminNavGroups(role, pendingSubmissionCount, staffRole).flatMap((g) => [...g.items]);
}
