"use client";

import { Gavel, LayoutDashboard, Palette, Store, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/bids", label: "Bids", icon: Gavel },
  { href: "/dashboard/portfolio", label: "Collection", icon: Palette },
  { href: "/dashboard/submissions", label: "Sell", icon: Store },
  { href: "/dashboard/settings/profile", label: "You", icon: User },
];

export function DashboardBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-outline-variant/15 bg-surface-container-lowest/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md lg:hidden"
      aria-label="Dashboard sections"
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const active =
          t.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-2 font-label text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              active ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-6" aria-hidden />
            <span className="truncate">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
