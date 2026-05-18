import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import type { StaffNavGroupSpec, StaffNavItemSpec } from "@/components/layout/staff-nav";
import type { NavEntry, NavGroup, NavItem } from "@/lib/shell/contracts";
import { isNavGroup } from "@/lib/shell/contracts";

function navItemActive(item: NavItem, pathname: string): boolean {
  return item.match
    ? item.match(pathname)
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Maps legacy sidebar items to the shared NavItem contract. */
export function appShellNavItemToNavItem(item: AppShellNavItem): NavItem {
  return {
    id: item.id,
    href: item.href,
    label: item.label,
    icon: item.icon,
    ...(item.badge !== undefined ? { badge: item.badge } : {}),
    ...(item.match ? { match: item.match } : {}),
  };
}

export function appShellNavItemsToNavItems(items: AppShellNavItem[]): NavItem[] {
  return items.map(appShellNavItemToNavItem);
}

export function staffNavItemSpecToNavItem(spec: StaffNavItemSpec): NavItem {
  return {
    id: spec.id,
    href: spec.href,
    label: spec.label,
    icon: spec.icon,
    ...(spec.badge !== undefined ? { badge: spec.badge } : {}),
    ...(spec.match ? { match: spec.match } : {}),
    requirement: spec.requirement,
  };
}

export function staffNavGroupSpecToNavGroup(group: StaffNavGroupSpec): NavGroup {
  return {
    id: group.id,
    title: group.title,
    icon: group.icon,
    items: group.items.map(staffNavItemSpecToNavItem),
  };
}

export function staffNavGroupsToNavEntries(groups: readonly StaffNavGroupSpec[]): NavEntry[] {
  return groups.map(staffNavGroupSpecToNavGroup);
}

export function navEntriesToFlatItems(entries: readonly NavEntry[]): NavItem[] {
  const out: NavItem[] = [];
  for (const entry of entries) {
    if (isNavGroup(entry)) out.push(...entry.items);
    else out.push(entry);
  }
  return out;
}

export function navEntriesToGroups(entries: readonly NavEntry[]): NavGroup[] {
  return entries.filter(isNavGroup);
}

/** Which accordion group should be open for the current path (longest matching child). */
export function getActiveNavGroupId(groups: readonly NavGroup[], pathname: string): string | null {
  let best: { score: number; groupId: string } | null = null;

  for (const group of groups) {
    for (const item of group.items) {
      if (!navItemActive(item, pathname)) continue;
      const score = item.href.length + (pathname === item.href ? 1000 : 0);
      if (!best || score > best.score) {
        best = { score, groupId: group.id };
      }
    }
  }
  return best?.groupId ?? null;
}
