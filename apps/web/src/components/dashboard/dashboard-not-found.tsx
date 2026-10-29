"use client";

import { AppNotFound } from "@/components/app/app-not-found";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { useAccountHomeLink } from "@/components/layout/account-switcher/use-account-home-link";
import { NOT_FOUND_PRESETS } from "@/lib/ui/empty-state-copy";

/**
 * The 404 for the client area, with the way back to the first page of the account in use:
 * Home inside an organisation, My bids for a personal account.
 */
export function DashboardNotFound() {
  const preset = NOT_FOUND_PRESETS.dashboard;
  const home = useAccountHomeLink();
  return (
    <DashboardPage className="mx-auto max-w-xl py-12">
      <AppNotFound
        kicker={preset.kicker}
        title={preset.title}
        description={preset.description}
        primaryHref={home.href}
        primaryLabel={home.label}
        secondaryHref={preset.secondaryHref}
        secondaryLabel={preset.secondaryLabel}
        illustration={preset.illustration}
      />
    </DashboardPage>
  );
}
