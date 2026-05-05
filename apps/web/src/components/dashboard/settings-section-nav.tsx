"use client";

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs";

const items = [
  { href: "/dashboard/settings/profile", label: "Profile" },
  { href: "/dashboard/settings/account", label: "Account" },
  { href: "/dashboard/settings/notifications", label: "Notifications" },
  { href: "/dashboard/settings/security", label: "Security" },
  { href: "/dashboard/settings/bidding", label: "Bidding" },
] as const;

export function SettingsSectionNav() {
  return (
    <DashboardSectionTabs
      ariaLabel="Settings sections"
      className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-3"
      items={items}
    />
  );
}
