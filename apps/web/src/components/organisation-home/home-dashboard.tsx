import type { OrganisationDashboardView } from "@/lib/organisation-home/organisation-dashboard-view";
import { HomeAtAGlance } from "./home-at-a-glance";
import { HomeConsignmentStages } from "./home-consignment-stages";
import { HomeFirstRun } from "./home-first-run";
import { HomeUpcomingSales } from "./home-upcoming-sales";

/**
 * The business figures after "Needs you": at a glance, the next sales and works by stage, or a
 * new organisation's first steps while there is nothing to count.
 */
export function HomeDashboard({ dashboard }: { dashboard: OrganisationDashboardView }) {
  if (dashboard.firstRun) return <HomeFirstRun firstRun={dashboard.firstRun} />;
  return (
    <>
      <HomeAtAGlance tiles={dashboard.tiles} />
      <HomeUpcomingSales sales={dashboard.upcomingSales} seeAllHref={dashboard.upcomingSalesHref} />
      {dashboard.stages ? <HomeConsignmentStages stages={dashboard.stages} /> : null}
    </>
  );
}
