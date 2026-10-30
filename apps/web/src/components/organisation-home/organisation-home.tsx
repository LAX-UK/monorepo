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
 * An organisation's Home: one calm column, the same for every member, each section shown only
 * when the role has something in it. Tasks come first, then the business figures, each linking
 * to the page behind it; there are no charts or trends. The account in use is named once, in the
 * strip under the header, so the page does not repeat it under its title.
 */
export function OrganisationHome({ home }: { home: LoadedOrganisationHome }) {
  const { view } = home;
  const notices = home.listLimitNotice
    ? [...view.notices, { key: "list-limit", text: home.listLimitNotice, href: null }]
    : view.notices;
  return (
    <DashboardPage>
      <SetMobileShellTitle title="Home" />
      {/* Phones show the title in the shell header. */}
      <DashboardPageHeader title="Home" className="lg:mb-6" />
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
      {/* Notices sit under "Needs you"; a role with nothing to do reads them on their own. */}
      {view.needsYou ? (
        <HomeNeedsYou tasks={view.needsYou} notices={notices} />
      ) : (
        <HomeNotices notices={notices} />
      )}
      {view.dashboard ? <HomeDashboard dashboard={view.dashboard} /> : null}
      <HomeShortcuts shortcuts={view.shortcuts} />
      <HomeActivity activity={view.activity} seeAllHref={view.seeAllHref} />
      <HomeRoleGuide explanation={home.roleExplanation} />
    </DashboardPage>
  );
}
