import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import type { LoadedOrganisationHome } from "@/lib/organisation-home/load-organisation-home.server";
import { Info } from "lucide-react";
import { HomeActivity } from "./home-activity";
import { HomeNeedsYou } from "./home-needs-you";
import { HomeRoleGuide } from "./home-role-guide";
import { HomeSetupLine } from "./home-setup-line";
import { HomeShortcuts } from "./home-shortcuts";
import { WelcomeCard } from "./welcome-card";

/**
 * An organisation's Home: the same layout for every member, each section shown only when the
 * role has something in it. No charts and no totals; money lives in Sold & payouts.
 */
export function OrganisationHome({ home }: { home: LoadedOrganisationHome }) {
  const { view } = home;
  return (
    <DashboardPage>
      <SetMobileShellTitle title="Home" />
      <div className="mx-auto max-w-4xl space-y-6">
        <DashboardPageHeader title="Home" description={home.organisationName} />
        {home.welcome ? (
          <WelcomeCard welcome={home.welcome} organisationName={home.organisationName} />
        ) : null}
        {view.setup ? <HomeSetupLine setup={view.setup} /> : null}
        {home.authority ? (
          <p className="flex items-start gap-2 font-body text-sm text-on-surface-variant">
            <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            {home.authority}
          </p>
        ) : null}
        {view.needsYou ? <HomeNeedsYou tasks={view.needsYou} /> : null}
        <HomeShortcuts shortcuts={view.shortcuts} />
        <HomeActivity activity={view.activity} seeAllHref={view.seeAllHref} />
        <HomeRoleGuide explanation={home.roleExplanation} />
      </div>
    </DashboardPage>
  );
}
