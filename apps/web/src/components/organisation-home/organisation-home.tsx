import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { OrganisationStateBanner } from "@/components/organisations/organisation-state-banner";
import type { LoadedOrganisationHome } from "@/lib/organisation-home/load-organisation-home.server";
import { Info } from "lucide-react";
import { HomeActivity } from "./home-activity";
import { HomeDashboard } from "./home-dashboard";
import { HomeNeedsYou } from "./home-needs-you";
import { HomeNotices } from "./home-notices";
import { HomeRoleGuide } from "./home-role-guide";
import { HomeShortcuts } from "./home-shortcuts";
import { WelcomeCard } from "./welcome-card";

/**
 * An organisation's Home: the same layout for every member, each section shown only when the
 * role has something in it. Tasks come first, then the business figures, each linking to the page
 * behind it; there are no charts or trends.
 */
export function OrganisationHome({ home }: { home: LoadedOrganisationHome }) {
  const { view } = home;
  return (
    <DashboardPage>
      <SetMobileShellTitle title="Home" />
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Phones show the title in the shell header. The wrapper keeps the section rhythm, as the
            header sets its own margins. */}
        <div className="hidden lg:block">
          <DashboardPageHeader
            title="Home"
            description={home.organisationName}
            hideTitleOnMobile
            hideDescriptionOnMobile
          />
        </div>
        {home.welcome ? (
          <WelcomeCard welcome={home.welcome} organisationName={home.organisationName} />
        ) : null}
        {view.banner ? <OrganisationStateBanner banner={view.banner} /> : null}
        {home.authority ? (
          <p className="flex items-start gap-2 font-body text-sm text-on-surface-variant">
            <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            {home.authority}
          </p>
        ) : null}
        {view.needsYou ? <HomeNeedsYou tasks={view.needsYou} /> : null}
        <HomeNotices
          notices={
            home.listLimitNotice
              ? [...view.notices, { key: "list-limit", text: home.listLimitNotice, href: null }]
              : view.notices
          }
        />
        {view.dashboard ? <HomeDashboard dashboard={view.dashboard} /> : null}
        <HomeShortcuts shortcuts={view.shortcuts} />
        <HomeActivity activity={view.activity} seeAllHref={view.seeAllHref} />
        <HomeRoleGuide explanation={home.roleExplanation} />
      </div>
    </DashboardPage>
  );
}
