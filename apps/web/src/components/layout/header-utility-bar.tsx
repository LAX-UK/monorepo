"use client";

import type { SessionUser } from "@/lib/data/contracts";
import Link from "next/link";
import { HeaderAuthLinks } from "./header-auth-links";
import { linkTop, utilityNav } from "./header-nav-config";

type HeaderUtilityBarProps = {
  user: SessionUser | null;
};

export function HeaderUtilityBar({ user }: HeaderUtilityBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-6">
      {utilityNav.map((item) => (
        <Link key={item.label} href={item.href} className={linkTop}>
          {item.label}
        </Link>
      ))}
      <HeaderAuthLinks user={user} />
    </div>
  );
}
