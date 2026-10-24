"use client";

import { type StaffLinkComponent, TabNav, type TabNavItem } from "@auction/staff-ui";
import { resolveActiveNavHref } from "@auction/ui/shell";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NextLink: StaffLinkComponent = Link;

/**
 * A record page's section tabs. The active tab follows the URL, so the tabs can live in a shared
 * layout that stays mounted while staff move between sections.
 */
export function StaffDetailTabs({ items, label }: { items: TabNavItem[]; label: string }) {
  const pathname = usePathname() ?? "";
  const activeHref = resolveActiveNavHref(
    pathname,
    items.map((item) => item.href),
  );
  const active = items.find((item) => item.href === activeHref) ?? items[0];
  return <TabNav items={items} activeId={active?.id ?? ""} label={label} Link={NextLink} />;
}
