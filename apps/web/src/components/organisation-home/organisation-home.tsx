import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { OrganisationStateBanner } from "@/components/organisations/organisation-state-banner";
import type { LoadedOrganisationHome } from "@/lib/organisation-home/load-organisation-home.server";
import { Button } from "@auction/ui/lax";
import { Info, Plus } from "lucide-react";
import Link from "next/link";
import { HomeActivity } from "./home-activity";
import { HomeAtAGlance } from "./home-at-a-glance";
import { HomeConsignmentStages } from "./home-consignment-stages";
import { HomeFiguresUnavailable } from "./home-figures-unavailable";
import { HomeFirstRun } from "./home-first-run";
import { HomeFirstSteps } from "./home-first-steps";
import { HomeNeedsYou } from "./home-needs-you";
import { HomeNotices } from "./home-notices";
import { HomeRoleGuide } from "./home-role-guide";
import { HomeShortcuts } from "./home-shortcuts";
import { HomeUpcomingSales } from "./home-upcoming-sales";
import { WelcomeCard } from "./welcome-card";

/**
 * An organisation's Home, the same frame for every member, each section shown only when the role
 * has something in it. First steps or "Needs you" come first (from the one reader), then the
 * figures at a glance, then two columns on desktop: sales and works by stage beside recent
 * activity and shortcuts. One column on phones. There are no charts or trends.
 */
export function OrganisationHome({ home }: { home: LoadedOrganisationHome }) {
  const { view } = home;
  const notices = home.listLimitNotice
    ? [...view.notices, { key: "list-limit", text: home.listLimitNotice, href: null }]
    : view.notices;
  const dashboard = view.dashboard;
  const firstRun = dashboard?.firstRun ?? null;
  const payoutsPending = view.firstSteps?.steps.some(
    (step) => step.id === "payouts" && step.state !== "done",
  );
  // With first steps on the page, an empty "Needs you" would only say "nothing" beside them.
  const showNeedsYou =
    view.needsYouFailed ||
    (view.needsYou !== null && !(view.firstSteps && view.needsYou.length === 0));
  const main = dashboard && !firstRun;
  const left = main ? (
    <>
      <HomeUpcomingSales sales={dashboard.upcomingSales} seeAllHref={dashboard.upcomingSalesHref} />
      {dashboard.stages ? <HomeConsignmentStages stages={dashboard.stages} /> : null}
    </>
  ) : null;
  const hasLeft = Boolean(main && (dashboard.upcomingSales.length > 0 || dashboard.stages));
  const hasRight = view.activity.length > 0 || view.shortcuts.length > 0;

  return (
    <DashboardPage className="space-y-0 md:space-y-0">
      <SetMobileShellTitle title="Home" />
      <DashboardPageHeader
        title="Home"
        description={home.description}
        className="mb-6 lg:mb-8"
        actions={
          home.sellHref ? (
            <Button
              asChild
              variant="secondary"
              icon={<Plus aria-hidden />}
              className="h-11 w-full sm:h-lax-control-md sm:w-auto"
            >
              <Link href={home.sellHref}>Sell a work</Link>
            </Button>
          ) : null
        }
      />
      <div className="space-y-8 lg:space-y-10">
        {home.welcome ? (
          <WelcomeCard welcome={home.welcome} organisationName={home.organisationName} />
        ) : null}
        {view.banner ? <OrganisationStateBanner banner={view.banner} /> : null}
        {home.authority ? (
          <p className="flex items-start gap-2 text-lax-14 text-lax-muted">
            <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            {home.authority}
          </p>
        ) : null}
        {view.firstSteps ? <HomeFirstSteps firstSteps={view.firstSteps} /> : null}
        {showNeedsYou ? (
          <HomeNeedsYou rows={view.needsYou ?? []} failed={view.needsYouFailed} notices={notices} />
        ) : (
          <HomeNotices notices={notices} />
        )}
        {dashboard === null ? <HomeFiguresUnavailable /> : null}
        {firstRun ? (
          <HomeFirstRun
            firstRun={firstRun}
            organisationName={home.organisationName}
            payoutsPending={payoutsPending ?? false}
          />
        ) : null}
        {main ? <HomeAtAGlance tiles={dashboard.tiles} /> : null}
        {hasLeft || hasRight ? (
          <div
            className={
              hasLeft && hasRight
                ? "grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-6"
                : "grid grid-cols-1 gap-8"
            }
          >
            {hasLeft ? <div className="flex min-w-0 flex-col gap-8 lg:gap-10">{left}</div> : null}
            {hasRight ? (
              <div className="flex min-w-0 flex-col gap-8 lg:gap-10">
                <HomeActivity activity={view.activity} seeAllHref={view.seeAllHref} />
                <HomeShortcuts shortcuts={view.shortcuts} />
              </div>
            ) : null}
          </div>
        ) : null}
        <HomeRoleGuide question={home.roleQuestion} explanation={home.roleExplanation} />
      </div>
    </DashboardPage>
  );
}
