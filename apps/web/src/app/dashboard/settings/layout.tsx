import { SettingsSectionNav } from "@/components/dashboard/settings-section-nav";
import type { ReactNode } from "react";

export default function DashboardSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="screen w-full space-y-6 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10 lg:space-y-0">
      <aside className="shrink-0">
        <SettingsSectionNav />
      </aside>
      <div className="min-w-0 lg:max-w-[640px]">{children}</div>
    </div>
  );
}
