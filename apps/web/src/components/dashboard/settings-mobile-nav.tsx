"use client";

import { SettingsInsetNav } from "@/components/dashboard/settings-inset-nav";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Mobile settings chrome — inset nav on the hub only; sub-routes use shell title. */
export function SettingsMobileHeader() {
  const pathname = usePathname();
  const isHub = pathname === "/dashboard/settings";

  if (!isHub) {
    return null;
  }

  return (
    <div className="lg:hidden">
      <SettingsInsetNav />
    </div>
  );
}

export function SettingsLayoutBody({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
