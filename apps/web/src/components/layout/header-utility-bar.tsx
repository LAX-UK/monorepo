"use client";

import { linkIsCurrent } from "@/lib/nav/is-current";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderAuthChip } from "./header-auth-chip";
import { linkTop, utilityNav } from "./header-nav-config";
import { useSiteHeaderChrome } from "./site-header-chrome-context";

export function HeaderUtilityBar() {
  const pathname = usePathname();
  const { blendWithHero } = useSiteHeaderChrome();

  return (
    <nav aria-label="Utility" className="flex flex-wrap items-center justify-end gap-6">
      {utilityNav.map((item) => {
        const current = linkIsCurrent(pathname, item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              linkTop,
              blendWithHero
                ? current
                  ? "text-white dark:text-on-surface"
                  : "text-white/80 hover:text-white dark:text-nav-text dark:hover:text-on-surface"
                : current && "text-brand-900 dark:text-on-surface",
            )}
            aria-current={current ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
      <HeaderAuthChip variant="account" />
    </nav>
  );
}
