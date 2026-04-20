"use client";

import Link from "next/link";
import { navItemActive, primaryNav } from "./header-nav-config";

type HeaderPrimaryNavProps = {
  pathname: string;
};

export function HeaderPrimaryNav({ pathname }: HeaderPrimaryNavProps) {
  return (
    <nav className="hidden items-center justify-center gap-9 lg:flex" aria-label="Primary">
      {primaryNav.map((item) => {
        const active = navItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`font-label text-sm font-medium uppercase leading-[21px] transition-colors ${
              active ? "text-brand-900" : "text-nav-text hover:text-brand-900"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
