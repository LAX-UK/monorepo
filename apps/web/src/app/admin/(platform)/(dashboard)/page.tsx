import { PersonalDashboard } from "@/components/admin/personal-dashboard/personal-dashboard";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { anomalyToneByKpiId } from "@/lib/admin/apply-anomaly-kpi-tones";
import { allowedDashboardWidgets, greetingActionsFor } from "@/lib/admin/dashboard-access";
import { getDashboardProfile } from "@/lib/admin/dashboard-profile-registry";
import {
  ADMIN_DASHBOARD_WIDGETS_COOKIE,
  isDashboardWidgetVisible,
  parseDashboardWidgetsCookie,
} from "@/lib/admin/dashboard-widgets.vm";
import {
  dashboardMetrics,
  dashboardMetricsPeriod,
} from "@/lib/admin/dashboard/dashboard-metrics.vm";
import {
  parseWorkArea,
  parseWorkAssignment,
  workAreasFor,
} from "@/lib/admin/dashboard/work-inbox.vm";
import { loadAdminDashboardPage } from "@/lib/admin/load-admin-dashboard-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { ADMIN_HOME_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { UserRole } from "@auction/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = metadataForPrivate(
  "Overview",
  "The work waiting on you, your role's numbers and recent activity.",
);

function greeting(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first ? `Good day, ${first}` : "Overview";
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; assignment?: string; area?: string; item?: string }>;
}) {
  const sp = await searchParams;
  const periodDays = parseAdminKpiPeriod(sp.period);
  const assignment = parseWorkAssignment(sp.assignment);
  // Decided before any data loads: finance staff go to their own overview, without a wasted
  // round of dashboard requests the API would refuse.
  const user = await requireAdminCapability(ADMIN_HOME_ACCESS, "/admin");
  const jar = await cookies();

  const role = (user.role ?? "staff") as UserRole;
  const staffRoles = user.staffRoles;
  const widgets = allowedDashboardWidgets(
    role,
    staffRoles,
    parseDashboardWidgetsCookie(jar.get(ADMIN_DASHBOARD_WIDGETS_COOKIE)?.value, staffRoles),
  );
  const showGreeting = isDashboardWidgetVisible(widgets, "greeting");

  const dashboard = await loadAdminDashboardPage({
    periodDays,
    role,
    staffRoles,
    actorUserId: user.id,
    workAssignment: assignment,
    widgets,
  });
  const workAreas = workAreasFor(getDashboardProfile(staffRoles).queueDomains);
  const area = parseWorkArea(sp.area);
  const recent = dashboard.recentActivity;
  const quick = greetingActionsFor(role, staffRoles).find(
    (action) => action.href !== dashboard.primaryAction.href,
  );
  const quickLink = quick ? { href: quick.href, label: quick.label } : null;

  return (
    <PersonalDashboard
      title={showGreeting ? greeting(user.name) : "Overview"}
      actorUserId={user.id}
      staffRoles={staffRoles}
      widgets={widgets}
      primaryAction={dashboard.primaryAction}
      quickLink={showGreeting ? quickLink : null}
      loadWarning={dashboard.loadWarning}
      workInbox={dashboard.workInbox}
      inboxQueues={dashboard.inboxQueues}
      workAreas={workAreas}
      area={area === "all" || workAreas.includes(area) ? area : "all"}
      assignment={assignment}
      openItemId={sp.item ?? null}
      periodDays={periodDays}
      metrics={
        dashboard.roleKpis.status === "ready"
          ? dashboardMetrics({
              periodDays,
              tiles: dashboard.roleKpis.data.tiles,
              metrics: dashboard.metrics,
              trends: dashboard.trends,
              bidsPerMinute: dashboard.bidsPerMinute,
              flagged: anomalyToneByKpiId(dashboard.anomalies),
            })
          : []
      }
      metricsPeriod={dashboardMetricsPeriod(periodDays)}
      saleReadiness={dashboard.saleReadiness}
      activeLotIds={dashboard.activeLotIds}
      activity={recent.status === "unavailable" ? [] : recent.data.rows}
      activityUnavailable={recent.status === "unavailable" ? recent.message : null}
    />
  );
}
