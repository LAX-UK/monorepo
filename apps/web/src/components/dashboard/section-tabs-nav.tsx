"use client";

import { type SectionTabItem, SectionTabs } from "@auction/ui/components/section-tabs";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type DashboardSectionTab = {
  href: string;
  label: string;
  badge?: string | number;
  isActive?: boolean;
};

type SectionTabsNavProps = {
  items: readonly DashboardSectionTab[];
  ariaLabel: string;
  className?: string;
  variant?: "underline" | "pill";
  sticky?: boolean;
  /** Tabs that are current only on their own address, not on the addresses below it. */
  exactHrefs?: readonly string[];
};

/**
 * Next.js adapter for `SectionTabs` with sentence-case tab names. The kit keeps underline tabs on
 * one line and scrolls them sideways when they do not fit, with a fade at the edge that hides
 * more.
 */
export function SectionTabsNav({
  items,
  ariaLabel,
  className,
  variant = "underline",
  sticky = true,
  exactHrefs = [],
}: SectionTabsNavProps) {
  const pathname = usePathname();
  const tabs: SectionTabItem[] = items.map((item) => ({
    id: item.href,
    label: item.label,
    href: item.href,
    badge: item.badge,
    active:
      item.isActive ??
      (pathname === item.href ||
        (!exactHrefs.includes(item.href) && pathname.startsWith(`${item.href}/`))),
  }));

  return (
    <SectionTabs
      ariaLabel={ariaLabel}
      items={tabs}
      variant={variant}
      casing="sentence"
      sticky={sticky}
      {...(className ? { className } : {})}
      renderLink={({ href, className: linkClass, children, ...rest }) => (
        <Link href={href} className={linkClass} {...rest}>
          {children}
        </Link>
      )}
    />
  );
}
