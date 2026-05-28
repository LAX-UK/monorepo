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
};

/** Next.js adapter for `SectionTabs` — replaces pill `DashboardSectionTabs`. */
export function SectionTabsNav({
  items,
  ariaLabel,
  className,
  variant = "underline",
  sticky = true,
}: SectionTabsNavProps) {
  const pathname = usePathname();
  const tabs: SectionTabItem[] = items.map((item) => ({
    id: item.href,
    label: item.label,
    href: item.href,
    badge: item.badge,
    active: item.isActive ?? (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  }));

  return (
    <SectionTabs
      ariaLabel={ariaLabel}
      items={tabs}
      variant={variant}
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
