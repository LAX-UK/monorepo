"use client";

import { TabNav, type TabNavItem } from "@auction/ui/lax";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  /** The page's name, for the tab list ("Team"). */
  label: string;
  /** The tabs in order; the first is the page's own address. */
  items: readonly TabNavItem[];
};

/**
 * The tabs of a workspace page with sub-pages (Team, Organisation), each with its count when it
 * has one. The current tab follows the address: the first tab only on the page's own address,
 * the others on theirs and anything below them.
 */
export function WorkspacePageTabs({ label, items }: Props) {
  const pathname = usePathname();
  const [first, ...rest] = items;
  const current =
    rest.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? first;
  if (!current) return null;
  return <TabNav items={items} activeId={current.id} label={label} Link={Link} />;
}
