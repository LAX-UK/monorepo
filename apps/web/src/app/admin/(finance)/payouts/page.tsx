import { AdminAnomalyBanner } from "@/components/admin/admin-anomaly-banner";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogKpiPeriodToggle } from "@/components/admin/catalog/catalog-kpi-period-toggle";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { PayoutsFilterToolbar } from "@/components/admin/finance/payouts-filter-toolbar";
import { AdminPayoutsBoardContainer } from "@/components/admin/payouts-board/container";
import { PayoutSettlementReadinessBand } from "@/components/admin/payouts-board/settlement-readiness-band";
import {
  buildPayoutsListKpiTiles,
  buildPayoutsMobileMetrics,
} from "@/lib/admin/finance/build-payouts-list-kpi-tiles";
import { loadAdminPayoutsListPage } from "@/lib/admin/finance/load-payouts-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Payouts",
  "Run seller settlements, review payout totals, and reconcile Stripe transfers.",
);

const financeBreadcrumbs = (
  <CatalogBreadcrumbs
    segments={[{ label: "Finance", href: "/admin/finance" }, { label: "Payouts" }]}
  />
);

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    status?: string;
    legalEntityId?: string;
    limit?: string;
    offset?: string;
    settlement?: string;
    period?: string;
    payout?: string;
  }>;
}) {
  const sp = await searchParams;

  if (sp.settlement === "1") {
    redirect("/admin/payouts/settlement");
  }

  const loaded = await loadAdminPayoutsListPage(sp);
  const { model, periodDays, payoutsTrend, summary, rows, loadError, anomalies, capabilities } =
    loaded;
  const success = safeDecodeAdminErrorParam(sp.success);
  const error = safeDecodeAdminErrorParam(sp.error);

  const statusChips = <FilterChipRow label="Payout status" chips={model.statusChipSpecs} />;

  return (
    <CatalogListShell
      title="Payouts"
      description="Run seller settlements, review payout totals, add finance adjustments, and mark Stripe transfers as paid."
      breadcrumbs={financeBreadcrumbs}
      primaryAction={
        capabilities.canProcess ? (
          <Button asChild>
            <Link href="/admin/payouts/settlement">Run settlement</Link>
          </Button>
        ) : null
      }
      hasFilters={model.hasFilters}
      resetHref={model.basePath}
      chips={statusChips}
      filters={
        !loadError ? (
          <PayoutsFilterToolbar
            {...(model.listFilters.legalEntityId
              ? { legalEntityId: model.listFilters.legalEntityId }
              : {})}
            {...(model.query.status ? { status: model.query.status } : {})}
            activeFilterCount={model.activeFilterCount}
            activeFilterChips={model.activeFilterChips}
            toolbarEnd={<CatalogKpiPeriodToggle current={periodDays} className="hidden lg:flex" />}
          />
        ) : null
      }
      filtersSelfContained
      mobileSummary={
        !loadError && loaded.total > 0 ? (
          <div className="space-y-3">
            <CatalogListMobileSummary metrics={buildPayoutsMobileMetrics(summary)} />
            <CatalogKpiPeriodToggle current={periodDays} className="lg:hidden" />
          </div>
        ) : null
      }
      kpiStrip={
        !loadError && loaded.total > 0 ? (
          <div className="space-y-4">
            {anomalies.length > 0 ? (
              <AdminAnomalyBanner anomalies={anomalies} storageKey="payouts" />
            ) : null}
            <AdminTrendKpiBand
              ariaLabel="Payouts summary"
              tiles={buildPayoutsListKpiTiles({ summary, trend: payoutsTrend, periodDays })}
            />
          </div>
        ) : null
      }
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Could not complete action">{loadError ?? error}</AdminListAlert>
        ) : null
      }
      empty={
        !loadError && rows.length === 0 ? (
          <CatalogListEmptyState
            title="No payouts found"
            description="Run settlement for a legal entity once captured payments are ready."
          />
        ) : null
      }
    >
      {!loadError && rows.length > 0 ? (
        <div className="space-y-6">
          {success ? (
            <Alert>
              <AlertTitle>Done</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}
          {model.showSettlementReadiness ? (
            <PayoutSettlementReadinessBand summary={summary} />
          ) : null}
          <AdminPayoutsBoardContainer
            rows={rows}
            selectedPayoutId={model.selectedPayoutId}
            statusChips={null}
            pagination={loaded.pagination}
            capabilities={capabilities}
          />
        </div>
      ) : null}
    </CatalogListShell>
  );
}
