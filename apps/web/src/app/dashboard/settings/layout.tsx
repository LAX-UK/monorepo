import { SettingsSectionNav } from "@/components/dashboard/settings-section-nav";
import type { ReactNode } from "react";
import { Suspense } from "react";

export default function DashboardSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="screen w-full">
      <div className="lg:grid lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <aside className="mb-8 shrink-0 lg:sticky lg:top-24 lg:mb-0 lg:self-start">
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/90 p-1 shadow-md backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/75">
            <Suspense
              fallback={
                <div
                  className="h-40 animate-pulse rounded-lg bg-surface-container-high/50"
                  aria-hidden
                />
              }
            >
              <SettingsSectionNav />
            </Suspense>
          </div>
        </aside>
        <div className="min-w-0 lg:max-w-3xl lg:pt-0.5">{children}</div>
      </div>
    </div>
  );
}
