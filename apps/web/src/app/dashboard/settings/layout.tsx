import { SettingsSectionNav } from "@/components/dashboard/settings-section-nav";
import type { ReactNode } from "react";

export default function DashboardSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[var(--container-inner,1376px)] flex-col gap-10 lg:flex-row lg:gap-12">
      <aside className="shrink-0 lg:w-52">
        <SettingsSectionNav />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
