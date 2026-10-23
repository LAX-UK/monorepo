"use client";

import { SettingsInsetNav } from "@/components/dashboard/settings-inset-nav";

type SettingsMobileHeaderProps = {
  accountHref: string | null;
};

/** Below the desktop breakpoint the settings list sits above the page instead of beside it. */
export function SettingsMobileHeader({ accountHref }: SettingsMobileHeaderProps) {
  return (
    <div className="lg:hidden">
      <SettingsInsetNav accountHref={accountHref} />
    </div>
  );
}
