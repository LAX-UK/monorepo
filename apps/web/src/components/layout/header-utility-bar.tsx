"use client";

import type { SessionUser } from "@/lib/data/contracts";
import { linkIsCurrent } from "@/lib/nav/is-current";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderAuthLinks } from "./header-auth-links";
import { linkTop, utilityNav } from "./header-nav-config";

type HeaderUtilityBarProps = {
  user: SessionUser | null;
};

export function HeaderUtilityBar({ user }: HeaderUtilityBarProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Utility" className="flex flex-wrap items-center justify-end gap-6">
      {utilityNav.map((item) => {
        const current = linkIsCurrent(pathname, item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(linkTop, current && "text-brand-900 dark:text-on-surface")}
            aria-current={current ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
      <HeaderAuthLinks user={user} />
    </nav>
  );
}
