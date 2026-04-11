"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import type { SessionUser } from "@/lib/data/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" },
  { href: "/dashboard/bids", label: "Active Bids", icon: "gavel" },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: "palette" },
] as const;

type Props = {
  user: SessionUser;
};

export function DashboardSidebar({ user }: Props) {
  const pathname = usePathname();

  return (
    <aside className="fixed z-50 flex h-full w-64 flex-col border-r border-outline-variant/20 bg-surface-container-lowest">
      <div className="p-8">
        <Link
          href="/"
          className="mb-12 block font-headline text-xl tracking-tighter text-on-surface"
        >
          The Digital Curator
        </Link>
        <p className="mb-2 font-label text-[10px] uppercase tracking-widest text-secondary">
          Signed in
        </p>
        <p className="font-body text-sm font-medium text-on-surface">{user.name}</p>
        <p className="mt-1 truncate font-body text-xs text-on-surface-variant">{user.email}</p>
        <nav className="mt-12 space-y-1" aria-label="Dashboard">
          {links.map((l) => {
            const active =
              l.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center border-l-4 px-4 py-3 text-xs font-medium uppercase tracking-widest transition-all ${
                  active
                    ? "border-primary bg-surface-container-low text-on-surface"
                    : "border-transparent text-on-surface hover:bg-surface-container-low/80"
                }`}
              >
                <MaterialIcon name={l.icon} className="mr-3 text-lg" />
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto p-8">
        <Link
          href="/"
          className="font-label text-[10px] uppercase tracking-widest text-primary transition-colors hover:underline"
        >
          Exit to gallery
        </Link>
      </div>
    </aside>
  );
}
