import { getAdminNavGroups } from "@/components/layout/admin-nav-groups";
import type { NavItem } from "@/lib/navigation/nav-types";

/** Flat list for command palette / consumers that need a single array */
export function getAdminNavItems(pendingSubmissionCount: number): readonly NavItem[] {
  return getAdminNavGroups(pendingSubmissionCount).flatMap((g) => [...g.items]);
}
