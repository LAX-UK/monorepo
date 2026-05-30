import { SettingsInsetNav } from "@/components/dashboard/settings-inset-nav";
import { SettingsMobileHeader } from "@/components/dashboard/settings-mobile-nav";
import { SETTINGS_CONTENT_MAX_WIDTH } from "@/lib/dashboard/settings-layout-classes";
import { Surface } from "@auction/ui/components/surface";
import type { ReactNode } from "react";
import { Suspense } from "react";

type Props = {
  children: ReactNode;
  /** Vertical spacing between mobile header and grid — settings uses 6, verify-identity uses 8. */
  spaceY?: 6 | 8;
};

/** Shared inset nav chrome for settings and identity verification routes. */
export function SettingsChromeLayout({ children, spaceY = 6 }: Props) {
  const outerSpace = spaceY === 8 ? "space-y-8" : "space-y-6";
  const mobileFallbackClass =
    spaceY === 8
      ? "h-12 animate-pulse rounded-xl bg-surface-container-high/50 lg:hidden"
      : "h-48 animate-pulse rounded-xl bg-surface-container-high/50 lg:hidden";

  return (
    <div className={`screen w-full ${outerSpace}`}>
      <Suspense fallback={<div className={mobileFallbackClass} aria-hidden />}>
        <SettingsMobileHeader />
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
