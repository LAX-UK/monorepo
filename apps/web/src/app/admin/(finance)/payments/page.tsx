import { AdminAnomalyBanner } from "@/components/admin/admin-anomaly-banner";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminPaymentsBoard } from "@/components/admin/admin-payments-board";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogKpiPeriodToggle } from "@/components/admin/catalog/catalog-kpi-period-toggle";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { PaymentsFilterToolbar } from "@/components/admin/finance/payments-filter-toolbar";
import { AdminManualReviewBoard } from "@/components/admin/manual-review-board";
import {
  buildManualReviewKpiTiles,
  buildPaymentsListKpiTiles,
} from "@/lib/admin/finance/build-payments-list-kpi-tiles";
import { loadAdminPaymentsListPage } from "@/lib/admin/finance/load-payments-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { formatCompactMoney } from "@/lib/ui/format";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Payments",
  "Capture, review, and reconcile buyer payments.",
);

const financeBreadcrumbs = (
  <CatalogBreadcrumbs
    segments={[{ label: "Finance", href: "/admin/finance" }, { label: "Payments" }]}
  />
);

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    status?: string;
    q?: string;
    limit?: string;
    offset?: string;
    period?: string;
    manualReview?: string;
    manualReviewReason?: string;
    success?: string;
  }>;
}) {
  const sp = await searchParams;
  const loaded = await loadAdminPaymentsListPage(sp);
  const { model, periodDays, paymentsTrend } = loaded;
  const {
    manualReviewQueue,
    hasListFilters,
    statusChipSpecs,
    manualReviewReasonChipSpecs,
    searchFilterChips,
    exportFilters,
  } = model;
  const success = safeDecodeAdminErrorParam(sp.success);
  const error = safeDecodeAdminErrorParam(sp.error);

  const statusChips = <FilterChipRow label="Filter by payment status" chips={statusChipSpecs} />;

  if (manualReviewQueue && loaded.mode === "manual-review") {
    const financeHoldCount = loaded.summary.financeHolds;
    const complianceHoldCount = loaded.summary.complianceHolds;
    return (
      <CatalogListShell
        variant="queue"
        title="Manual payment review"
        description="Winning payments held before checkout: finance (archived seller, high value) or compliance (AML hold, source of funds). Compliance holds cannot be released until MLRO clears the case."
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[
              { label: "Finance", href: "/admin/finance" },
              { label: "Payments", href: "/admin/payments" },
              { label: "Manual review" },
            ]}
          />
        }
        hasFilters={manualReviewQueue}
        resetHref="/admin/payments?manualReview=1"
        chips={
          <>
            {statusChips}
            <FilterChipRow label="Filter by hold reason" chips={manualReviewReasonChipSpecs} />
          </>
        }
        errorAlert={
          error || loaded.loadError ? (
            <AdminListAlert title="Could not complete action">
              {loaded.loadError ?? error}
            </AdminListAlert>
          ) : null
        }
        kpiStrip={
          loaded.allRows.length > 0 ? (
            <div className="space-y-4">
              <AdminTrendKpiBand
                ariaLabel="Manual review summary"
                tiles={buildManualReviewKpiTiles({
                  total: loaded.allRows.length,
                  financeHolds: financeHoldCount,
                  complianceHolds: complianceHoldCount,
                })}
              />
              {loaded.anomalies.length > 0 ? (
                <AdminAnomalyBanner anomalies={loaded.anomalies} storageKey="manual-review" />
              ) : null}
            </div>
          ) : loaded.anomalies.length > 0 ? (
            <AdminAnomalyBanner anomalies={loaded.anomalies} storageKey="manual-review" />
          ) : null
        }
        mobileSummary={
          loaded.allRows.length > 0 ? (
            <CatalogListMobileSummary
              metrics={[
                { id: "total", label: "Holds", value: String(loaded.allRows.length) },
                { id: "finance", label: "Finance", value: String(financeHoldCount) },
                { id: "compliance", label: "Compliance", value: String(complianceHoldCount) },
              ]}
            />
          ) : null
        }
        empty={
          !loaded.loadError && !success && loaded.rows.length === 0 ? (
            <CatalogListEmptyState
              title="No manual review payments"
              description="Payments in requires_manual_review will appear here — finance or compliance holds."
            />
          ) : null
        }
      >
        {!loaded.loadError && (success || loaded.rows.length > 0) ? (
          <div className="space-y-4">
            {success ? (
              <Alert>
                <AlertTitle>Done</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            ) : null}
            {loaded.rows.length > 0 ? (
              <AdminManualReviewBoard
                rows={loaded.rows}
                canOpenComplianceQueues={loaded.canOpenComplianceQueues}
              />
            ) : null}
          </div>
        ) : null}
      </CatalogListShell>
    );
  }

  if (loaded.mode !== "payments") {
    throw new Error("Payment list mode did not match the page model.");
  }
  const {
    rows: paymentRows,
    summary,
    total,
    loadError,
    anomalies: paymentAnomalies,
    pagination: boardPagination,
  } = loaded;

  const boardFilterControls = {
    searchPlaceholder: "Search lot, buyer, or payment id…",
    sheetTitle: "Payment filters",
    activeFilterCount: searchFilterChips.length,
    searchInputId: "admin-payments-table-search",
  };

  return (
    <CatalogListShell
      title="Payments"
      description="Filter by status, search payments, and use the drawer for capture/refund on touch devices."
      breadcrumbs={financeBreadcrumbs}
      hasFilters={hasListFilters}
      resetHref="/admin/payments"
      filters={
        <PaymentsFilterToolbar
          activeFilterChips={searchFilterChips}
          toolbarEnd={<CatalogKpiPeriodToggle current={periodDays} className="hidden lg:flex" />}
          stickyOnly
        />
      }
      filtersSelfContained
      mobileSummary={
        !loadError && total > 0 ? (
          <div className="space-y-3">
            <CatalogListMobileSummary
              metrics={[
                { id: "volume", label: "Volume", value: formatCompactMoney(summary.totalVolume) },
                {
                  id: "pending",
                  label: "Awaiting action",
                  value: formatCompactMoney(summary.pending),
                },
                { id: "captured", label: "Settled", value: formatCompactMoney(summary.captured) },
              ]}
            />
            <CatalogKpiPeriodToggle current={periodDays} className="lg:hidden" />
          </div>
        ) : null
      }
      kpiStrip={
        !loadError && total > 0 ? (
          <>
            {paymentAnomalies.length > 0 ? (
              <AdminAnomalyBanner anomalies={paymentAnomalies} storageKey="payments" />
            ) : null}
            <AdminTrendKpiBand
              ariaLabel="Payments summary"
              tiles={buildPaymentsListKpiTiles({
                summary,
                trend: paymentsTrend,
                periodDays,
              })}
            />
          </>
        ) : null
      }
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Could not load payments">{loadError ?? error}</AdminListAlert>
        ) : null
      }
      empty={
        !loadError && total === 0 ? (
          <AdminEmptyState
            title="No payments"
            description="No payment records match the current filters."
          />
        ) : null
      }
    >
      {!loadError && paymentRows.length > 0 ? (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          <AdminPaymentsBoard
            rows={paymentRows}
            statusChips={statusChips}
            filterControls={boardFilterControls}
            exportFilters={exportFilters}
            pagination={boardPagination}
          />
        </Suspense>
      ) : null}
    </CatalogListShell>
  );
}
