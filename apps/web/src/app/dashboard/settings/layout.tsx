import {
  DashboardComplianceStrip,
  DashboardComplianceStripSkeleton,
} from "@/components/dashboard/dashboard-compliance-strip";
import { SettingsInsetNav } from "@/components/dashboard/settings-inset-nav";
import { Surface } from "@auction/ui/components/surface";
import type { ReactNode } from "react";
import { Suspense } from "react";

export default function DashboardSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="screen w-full space-y-8">
      <Suspense fallback={<DashboardComplianceStripSkeleton />}>
        <DashboardComplianceStrip loginNext="/dashboard/settings" />
      </Suspense>
      <Suspense
        fallback={
          <div
            className="h-48 animate-pulse rounded-xl bg-surface-container-high/50 lg:hidden"
            aria-hidden
          />
        }
      >
        <SettingsInsetNav className="lg:hidden" />
      </Suspense>
      <div className="lg:grid lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <aside className="hidden shrink-0 lg:sticky lg:top-24 lg:block lg:self-start">
          <Surface variant="inset" padding="sm">
            <Suspense
              fallback={
                <div
                  className="h-40 animate-pulse rounded-lg bg-surface-container-high/50"
                  aria-hidden
                />
              }
            >
              <SettingsInsetNav />
            </Suspense>
          </Surface>
        </aside>
        <div className="min-w-0 lg:max-w-3xl lg:pt-0.5">{children}</div>
      </div>
    </div>
  );
}
