import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { CatalogKpiPeriodToggle } from "@/components/admin/catalog/catalog-kpi-period-toggle";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { StaffHubShell } from "@/components/admin/catalog/staff-hub-shell";
import { PersonalDashboardCustomizeSheet } from "@/components/admin/personal-dashboard/customize-sheet";
import {
  PersonalDashboard,
  PersonalDashboardKpiBand,
} from "@/components/admin/personal-dashboard/personal-dashboard";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { allowedDashboardWidgets } from "@/lib/admin/dashboard-access";
import {
  ADMIN_DASHBOARD_WIDGETS_COOKIE,
  isDashboardWidgetVisible,
  parseDashboardWidgetsCookie,
} from "@/lib/admin/dashboard-widgets.vm";
import { loadAdminDashboardPage } from "@/lib/admin/load-admin-dashboard-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { UserRole, UserStaffRole } from "@auction/types";
import { LabelCaps } from "@auction/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = metadataForPrivate(
  "Your dashboard",
  "Trend-aware KPIs, attention items, anomalies, and saleroom pulse.",
);

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const periodDays = parseAdminKpiPeriod(sp.period);
  const user = await requireAuthenticatedUser({ shell: "staff", loginNext: "/admin" });
  const jar = await cookies();

  const role = (user.role ?? "staff") as UserRole;
  const staffRole = (user.staffRole ?? null) as UserStaffRole | null;

  const rawWidgets = parseDashboardWidgetsCookie(
    jar.get(ADMIN_DASHBOARD_WIDGETS_COOKIE)?.value,
    staffRole,
  );
  const widgets = allowedDashboardWidgets(role, staffRole, rawWidgets);

  const dashboard = await loadAdminDashboardPage({ periodDays, role, staffRole, widgets });
  const showKpiBand = isDashboardWidgetVisible(widgets, "kpi-band");

  return (
    <StaffHubShell
      title="Your dashboard"
      description="Trend-aware KPIs, attention items, anomalies, and saleroom pulse — layout saved on this device."
      meta={<LabelCaps className="text-lot-orange">Admin · Personal</LabelCaps>}
      primaryAction={<PersonalDashboardCustomizeSheet widgets={widgets} staffRole={staffRole} />}
      postKpiToolbarEnd={<CatalogKpiPeriodToggle current={periodDays} />}
      kpiStrip={
        showKpiBand ? (
          <PersonalDashboardKpiBand
            periodDays={periodDays}
            metrics={dashboard.metrics}
            trends={dashboard.trends}
            bidsPerMinute={dashboard.bidsPerMinute}
          />
        ) : null
      }
      mobileSummary={
        showKpiBand ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "live", label: "Live lots", value: String(dashboard.metrics.liveLots) },
              {
                id: "payments",
                label: "Stale payments",
                value: String(dashboard.metrics.stalePendingPayments),
              },
              { id: "bids", label: "Bids/min", value: String(dashboard.bidsPerMinute) },
            ]}
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
          userName={user.name}
          periodDays={periodDays}
          widgets={widgets}
          metrics={dashboard.metrics}
          trends={dashboard.trends}
          bidsPerMinute={dashboard.bidsPerMinute}
          activeLotIds={dashboard.activeLotIds}
          attention={dashboard.attention}
          activity={dashboard.activity}
          anomalies={dashboard.anomalies}
          onsiteRadarRows={dashboard.onsiteRadarRows}
          activeSaleroomSessions={dashboard.activeSaleroomSessions}
          hubLinks={dashboard.hubLinks}
          includeKpiBand={false}
        />
      }
    />
  );
}
