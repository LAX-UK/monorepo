"use client";

import { SettingsInsetNav } from "@/components/dashboard/settings-inset-nav";

/** Below the desktop breakpoint the settings list sits above the page instead of beside it. */
export function SettingsMobileHeader() {
  return (
    <div className="lg:hidden">
      <SettingsInsetNav />
    </div>
  );
}
