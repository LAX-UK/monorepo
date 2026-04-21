import { dashboardNavGroups } from "@/components/layout/dashboard-nav-groups";
import type { NavItem } from "@/lib/navigation/nav-types";

/** Flat list for command palette / legacy consumers */
export const dashboardNavItems: readonly NavItem[] = dashboardNavGroups.flatMap((g) => [
  ...g.items,
]);
