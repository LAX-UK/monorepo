"use client";

import { SettingsInsetNav } from "@/components/dashboard/settings-inset-nav";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const SETTINGS_SUBPAGE_LINKS = [
  { href: "/dashboard/settings/profile", label: "Profile" },
  { href: "/dashboard/settings/account", label: "Account" },
  { href: "/dashboard/settings/security", label: "Security" },
  { href: "/dashboard/settings/notifications", label: "Notifications" },
  { href: "/dashboard/settings/appearance", label: "Appearance" },
  { href: "/dashboard/settings/bidding", label: "Bidding" },
  { href: "/dashboard/settings/addresses", label: "Addresses" },
  { href: "/dashboard/settings/payment-methods", label: "Payments" },
  { href: "/dashboard/settings/sessions", label: "Sessions" },
] as const;

function SettingsSubpageChips() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="sticky top-[var(--header-height-mobile,56px)] z-10 -mx-4 border-b border-border-hairline bg-surface/95 backdrop-blur-sm lg:hidden"
    >
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 py-2">
        {SETTINGS_SUBPAGE_LINKS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard/settings/profile" && pathname.startsWith(`${item.href}/`)) ||
            (item.href === "/dashboard/settings/profile" && pathname === "/dashboard/settings");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 snap-start rounded-full border px-3 py-1.5 font-label text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors",
                active
                  ? "border-primary/40 bg-primary-container/25 text-primary"
                  : "border-border-hairline bg-surface-container-low/50 text-on-surface-variant hover:text-on-surface",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SettingsMobileHeader() {
  const pathname = usePathname();
  const isHub = pathname === "/dashboard/settings";

  if (isHub) {
    return (
      <div className="lg:hidden">
        <SettingsInsetNav />
      </div>
    );
  }

  return <SettingsSubpageChips />;
}

export function SettingsLayoutBody({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
