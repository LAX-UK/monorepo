import { SettingsSectionNav } from "@/components/dashboard/settings-section-nav";
import type { ReactNode } from "react";

export default function DashboardSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-(--container-inner,1376px) space-y-6">
      <aside className="shrink-0">
        <SettingsSectionNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
