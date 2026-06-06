import { AdminAnomalyBanner } from "@/components/admin/admin-anomaly-banner";
import { AdminFinanceKpiRows } from "@/components/admin/admin-finance-kpi-rows";
import { AdminHubQuickLinks } from "@/components/admin/admin-hub-quick-links";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import { mapFinanceHubQuickLinks } from "@/lib/admin/finance-hub-links";
import { getFinanceAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminFinanceIssues } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Finance",
  "Payments, payouts, disputes, and accounting integrations.",
);

export default async function FinanceAdminHomePage() {
  let financeIssues: Awaited<ReturnType<typeof getAdminFinanceIssues>> | null = null;
  let financeIssuesLoadError: string | null = null;
  try {
    financeIssues = await getAdminFinanceIssues();
  } catch (e) {
    financeIssuesLoadError = e instanceof Error ? e.message : "Could not load finance KPI data.";
    financeIssues = null;
  }

  let navCounts = EMPTY_ADMIN_NAV_COUNTS;
  try {
    navCounts = await getFinanceAdminNavCounts();
  } catch {
    /* use empty */
  }

  const anomalies = detectAnomaliesFromNavCounts(navCounts, {
    failedPayouts: financeIssues?.failedPayoutCount ?? 0,
  });

  return (
    <AdminListShell
      layout="hub"
      title="Finance"
      description="Payments, payouts, disputes, and accounting integrations."
      mobileSummary={
        <CatalogListMobileSummary
          metrics={[
            {
              id: "manual-review",
              label: "Manual review",
              value: String(navCounts.manualReviewCount),
            },
            { id: "disputes", label: "Open disputes", value: String(navCounts.disputesOpen) },
            {
              id: "payouts",
              label: "Failed payouts",
              value: String(financeIssues?.failedPayoutCount ?? navCounts.payoutsFailed),
            },
          ]}
        />
      }
      view={
        <div className="space-y-8">
          {financeIssues ? (
            <AdminFinanceKpiRows financeIssues={financeIssues} />
          ) : !financeIssuesLoadError ? (
            <AdminListKpiStrip
              ariaLabel="Finance nav counts"
              tiles={[
                { label: "Manual review", value: navCounts.manualReviewCount },
                { label: "Open disputes", value: navCounts.disputesOpen },
                { label: "Failed payouts", value: navCounts.payoutsFailed },
              ]}
            />
          ) : null}
          {anomalies.length > 0 ? (
            <AdminAnomalyBanner anomalies={anomalies} storageKey="finance-home" />
          ) : null}
          {financeIssuesLoadError ? (
            <AdminListAlert title="Could not load finance KPIs">
              {financeIssuesLoadError}
            </AdminListAlert>
          ) : null}
          <AdminHubQuickLinks
            ariaLabel="Finance quick links"
            links={mapFinanceHubQuickLinks(navCounts)}
          />
        </div>
      }
    />
  );
}
