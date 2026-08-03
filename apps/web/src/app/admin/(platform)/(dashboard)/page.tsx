import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { CatalogKpiPeriodToggle } from "@/components/admin/catalog/catalog-kpi-period-toggle";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { StaffHubShell } from "@/components/admin/catalog/staff-hub-shell";
import { PersonalDashboardCustomizeSheet } from "@/components/admin/personal-dashboard/customize-sheet";
import { DashboardKpiSummary } from "@/components/admin/personal-dashboard/dashboard-kpi-summary";
import { PersonalDashboard } from "@/components/admin/personal-dashboard/personal-dashboard";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { anomalyToneByKpiId } from "@/lib/admin/apply-anomaly-kpi-tones";
import { allowedDashboardWidgets, greetingActionsFor } from "@/lib/admin/dashboard-access";
import {
  ADMIN_DASHBOARD_WIDGETS_COOKIE,
  isDashboardWidgetVisible,
  parseDashboardWidgetsCookie,
} from "@/lib/admin/dashboard-widgets.vm";
import { loadAdminDashboardPage } from "@/lib/admin/load-admin-dashboard-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { UserRole, UserStaffRole } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Your dashboard",
  "Prioritized work, live operations, and role-relevant trends.",
);

function personalizedTitle(name: string): string {
  const first = name.trim().split(/\s+/)[0] || "there";
  return `Good day, ${first}`;
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; assignment?: string }>;
}) {
  const sp = await searchParams;
  const periodDays = parseAdminKpiPeriod(sp.period);
  const workAssignment =
    sp.assignment === "mine" || sp.assignment === "unassigned" ? sp.assignment : "all";
  const user = await requireAuthenticatedUser({
    shell: "staff",
    loginNext: "/admin",
  });
  const jar = await cookies();

  const role = (user.role ?? "staff") as UserRole;
  const staffRole = (user.staffRole ?? null) as UserStaffRole | null;

  const rawWidgets = parseDashboardWidgetsCookie(
    jar.get(ADMIN_DASHBOARD_WIDGETS_COOKIE)?.value,
    staffRole,
  );
  const widgets = allowedDashboardWidgets(role, staffRole, rawWidgets);
  const showKpiBand = isDashboardWidgetVisible(widgets, "kpi-band");
  const greetingActions = greetingActionsFor(role, staffRole);
  const primaryQuickLink = greetingActions[0];

  const dashboard = await loadAdminDashboardPage({
    periodDays,
    role,
    staffRole,
    actorUserId: user.id,
    workAssignment,
    widgets,
  });
  const urgentCount =
    dashboard.workInbox.status === "ready" || dashboard.workInbox.status === "empty"
      ? dashboard.workInbox.data.counts.urgent
      : 0;
  const mobileKpiTiles =
    dashboard.roleKpis.status === "ready"
      ? dashboard.roleKpis.data.tiles.filter((tile) => tile.available).slice(0, 3)
      : [];
  const anomalyTones = anomalyToneByKpiId(dashboard.anomalies);

  return (
    <StaffHubShell
      title={personalizedTitle(user.name)}
      description="Your queue, then the context you need to resolve it."
      primaryAction={
        <div className="flex items-center gap-1">
          <Link
            href={dashboard.primaryAction.href}
            className="inline-flex min-h-9 items-center rounded-md bg-primary px-4 py-2 font-body text-sm font-medium text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {dashboard.primaryAction.label}
          </Link>
          {primaryQuickLink ? (
            <Link
              href={primaryQuickLink.href}
              className="hidden min-h-9 items-center rounded-md px-3 py-2 font-body text-sm text-on-surface-variant hover:text-on-surface sm:inline-flex"
            >
              {primaryQuickLink.label}
            </Link>
          ) : null}
          <PersonalDashboardCustomizeSheet widgets={widgets} staffRole={staffRole} iconOnly />
        </div>
      }
      kpiStrip={
        showKpiBand ? (
          dashboard.roleKpis.status === "unavailable" ? (
            <Surface variant="section" padding="md" className="border-border-hairline">
              <DashboardEmptyState
                variant="quiet"
                title="KPI summary unavailable"
                description={dashboard.roleKpis.message}
                headingLevel="h3"
              />
            </Surface>
          ) : (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <DashboardKpiSummary
                  periodDays={periodDays}
                  metrics={dashboard.metrics}
                  trends={dashboard.trends}
                  bidsPerMinute={dashboard.bidsPerMinute}
                  roleKpis={dashboard.roleKpis}
                  profileId={dashboard.profileId}
                  anomalyTones={anomalyTones}
                />
              </div>
              <div className="hidden shrink-0 lg:block">
                <CatalogKpiPeriodToggle current={periodDays} />
              </div>
            </div>
          )
        ) : null
      }
      mobileSummary={
        urgentCount > 0 ? (
          <CatalogListMobileSummary
            metrics={[
              {
                id: "urgent",
                label: "Urgent items",
                value: String(urgentCount),
              },
            ]}
          />
        ) : mobileKpiTiles.length > 0 ? (
          <CatalogListMobileSummary
            metrics={mobileKpiTiles.map((tile) => ({
              id: tile.id,
              label: tile.label,
              value: tile.value,
            }))}
          />
        ) : null
      }
      errorAlert={
        dashboard.loadWarning ? (
          <AdminListAlert title="Some dashboard data could not load">
            {dashboard.loadWarning}
          </AdminListAlert>
        ) : null
      }
      view={
        <PersonalDashboard
          actorUserId={user.id}
          widgets={widgets}
          staffRole={staffRole}
          activeLotIds={dashboard.activeLotIds}
          workAssignment={workAssignment}
          workInbox={dashboard.workInbox}
          saleReadiness={dashboard.saleReadiness}
          recentActivity={dashboard.recentActivity}
        />
      }
    />
  );
}
