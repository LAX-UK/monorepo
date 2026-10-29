"use client";

import { cn } from "@auction/ui";
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
 * Next.js adapter for `SectionTabs` with sentence-case tab names. The tabs stay on one line and
 * scroll sideways when they do not fit (on phones), with a fade at the edge that shows there is
 * more; they never wrap onto a second line.
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
    <div className="-mx-4 overflow-x-auto px-4 pt-1 [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1.5rem),transparent)] [scrollbar-width:none] sm:mx-0 sm:px-0 sm:[mask-image:none]">
      <SectionTabs
        ariaLabel={ariaLabel}
        items={tabs}
        variant={variant}
        casing="sentence"
        sticky={sticky}
        className={cn("w-max min-w-full flex-nowrap", className)}
        renderLink={({ href, className: linkClass, children, ...rest }) => (
          <Link href={href} className={linkClass} {...rest}>
            {children}
          </Link>
        )}
      />
    </div>
  );
}
