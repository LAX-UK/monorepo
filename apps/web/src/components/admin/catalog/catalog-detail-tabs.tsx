"use client";

import { cn } from "@auction/ui";
import { SectionTabs } from "@auction/ui/components/section-tabs";
import Link from "next/link";
import type { ReactNode } from "react";

export type CatalogDetailTab = {
  id: string;
  label: ReactNode;
  href: string;
  badge?: ReactNode;
  active?: boolean;
};

type Props = {
  tabs: readonly CatalogDetailTab[];
  activeId: string;
  ariaLabel: string;
  className?: string;
};

/** Inline underline tabs — not sticky. */
export function CatalogDetailTabs({ tabs, activeId, ariaLabel, className }: Props) {
  return (
    <SectionTabs
      ariaLabel={ariaLabel}
      active={activeId}
      variant="underline"
      sticky={false}
      className={cn("mb-6", className)}
      items={tabs.map((t) => ({
        id: t.id,
        label: (
          <>
            {t.label}
            {t.badge}
          </>
        ),
        href: t.href,
        ...(t.active !== undefined ? { active: t.active } : {}),
      }))}
      renderLink={({ href, className: linkClass, children, ...rest }) => (
        <Link href={href} className={linkClass} scroll={false} {...rest}>
          {children}
        </Link>
      )}
    />
  );
}
