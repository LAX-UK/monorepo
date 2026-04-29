"use client";

import type { SessionUser } from "@/lib/data/contracts";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import { BarChart3, ClipboardList, Gavel, LayoutDashboard, Plug, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const platformTabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Home", icon: LayoutDashboard },
  { href: "/admin/lots", label: "Lots", icon: Gavel },
  { href: "/admin/submissions", label: "Intake", icon: ClipboardList },
  { href: "/admin/payments", label: "Pay", icon: Wallet },
  { href: "/admin/analytics", label: "Stats", icon: BarChart3 },
];

const financeTabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/payments", label: "Pay", icon: Wallet },
  { href: "/admin/integrations/xero", label: "Xero", icon: Plug },
];

type Props = { user: SessionUser };

export function AdminBottomNav({ user }: Props) {
  const pathname = usePathname();
  const role = user.role as UserRole;
  const tabs = canAccessPlatformAdminRoutes(role) ? platformTabs : financeTabs;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-outline-variant/20 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md lg:hidden"
      aria-label="Admin sections"
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const active =
          t.href === "/admin"
            ? pathname === "/admin"
            : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md py-2 font-label text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors ${
              active
                ? "bg-black/[0.04] text-black"
                : "text-on-surface-variant hover:text-on-surface"
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
