import {
  DashboardComplianceStrip,
  DashboardComplianceStripSkeleton,
} from "@/components/dashboard/dashboard-compliance-strip";
import { SettingsInsetNav } from "@/components/dashboard/settings-inset-nav";
import { VerifyIdentityMobileNav } from "@/components/dashboard/verify-identity-mobile-nav";
import { SETTINGS_CONTENT_MAX_WIDTH } from "@/lib/dashboard/settings-layout-classes";
import { Surface } from "@auction/ui/components/surface";
import type { ReactNode } from "react";
import { Suspense } from "react";

/** Identity verification uses the same settings chrome for consistent wayfinding. */
export default function VerifyIdentitySettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="screen w-full space-y-8">
      <Suspense fallback={<DashboardComplianceStripSkeleton />}>
        <DashboardComplianceStrip loginNext="/dashboard/verify-identity" />
      </Suspense>
      <Suspense
        fallback={
          <div
            className="h-48 animate-pulse rounded-xl bg-surface-container-high/50 lg:hidden"
            aria-hidden
          />
        }
      >
        <VerifyIdentityMobileNav />
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
        <div className={`min-w-0 ${SETTINGS_CONTENT_MAX_WIDTH} lg:pt-0.5`}>{children}</div>
      </div>
    </div>
  );
}
