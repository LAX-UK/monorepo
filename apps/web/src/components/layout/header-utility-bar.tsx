"use client";

import { type SiteHeaderTone, headerUtilityLinkClass } from "@/lib/layout/header-chrome-tone";
import { linkIsCurrent } from "@/lib/nav/is-current";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { utilityNav } from "./header-nav-config";

type Props = {
  headerTone?: SiteHeaderTone;
};

export function HeaderUtilityBar({ headerTone = "on-light" }: Props) {
  const pathname = usePathname();

  return (
    <nav aria-label="Utility" className="flex flex-wrap items-center justify-end gap-6">
      {utilityNav.map((item) => {
        const current = linkIsCurrent(pathname, item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={headerUtilityLinkClass(headerTone, current)}
            aria-current={current ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
