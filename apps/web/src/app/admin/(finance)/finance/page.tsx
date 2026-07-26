import { AdminAnomalyBanner } from "@/components/admin/admin-anomaly-banner";
import { AdminFinanceKpiRows } from "@/components/admin/admin-finance-kpi-rows";
import { AdminHubQuickLinks } from "@/components/admin/admin-hub-quick-links";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { StaffHubShell } from "@/components/admin/catalog/staff-hub-shell";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import { mapFinanceHubQuickLinks } from "@/lib/admin/finance-hub-links";
import { loadAdminFinanceHubPage } from "@/lib/admin/finance/load-finance-hub-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Finance",
  "Payments, payouts, disputes, and accounting integrations.",
);

export default async function FinanceAdminHomePage() {
  const { financeIssues, navCounts, anomalies, failedPayouts, loadError } =
    await loadAdminFinanceHubPage();

  return (
    <StaffHubShell
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
            { id: "payouts", label: "Failed payouts", value: String(failedPayouts) },
          ]}
        />
      }
      kpiStrip={
        financeIssues ? null : !loadError ? (
          <AdminTrendKpiBand
            ariaLabel="Finance nav counts"
            tiles={[
              buildSnapshotKpiTile("Manual review", navCounts.manualReviewCount, 30, {
                compareHint: "Payments awaiting release",
                semanticTone: navCounts.manualReviewCount > 0 ? "warning" : "default",
              }),
              buildSnapshotKpiTile("Open disputes", navCounts.disputesOpen, 30, {
                compareHint: "Stripe dispute cases",
                semanticTone: navCounts.disputesOpen > 0 ? "danger" : "default",
              }),
              buildSnapshotKpiTile("Failed payouts", failedPayouts, 30, {
                compareHint: "Transfer or reconciliation failures",
                semanticTone: failedPayouts > 0 ? "danger" : "default",
              }),
            ]}
          />
        ) : null
      }
      errorAlert={
        loadError ? (
          <AdminListAlert title="Could not load finance KPIs">{loadError}</AdminListAlert>
        ) : null
      }
      view={
        <div className="space-y-8">
          {financeIssues ? <AdminFinanceKpiRows financeIssues={financeIssues} /> : null}
          {anomalies.length > 0 ? (
            <AdminAnomalyBanner anomalies={anomalies} storageKey="finance-home" />
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
