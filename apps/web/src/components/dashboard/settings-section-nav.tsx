"use client";

import { SectionNav } from "@auction/ui/components/section-nav";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard/settings/profile", label: "Profile" },
  { href: "/dashboard/settings/bidding", label: "Bidding" },
  { href: "/dashboard/settings/notifications", label: "Notifications" },
  { href: "/dashboard/settings/security", label: "Security" },
] as const;

export function SettingsSectionNav() {
  const pathname = usePathname();
  return (
    <SectionNav
      aria-label="Settings sections"
      className="rounded-sm border border-outline-variant/20 bg-white px-2 py-2"
      items={items.map((item) => ({
        ...item,
        active: pathname === item.href || pathname.startsWith(`${item.href}/`),
      }))}
    />
  );
}
