import { AdminAnomalyBanner } from "@/components/admin/admin-anomaly-banner";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { AdminListSearchGet } from "@/components/admin/admin-list-search";
import { AdminPaymentsBoard } from "@/components/admin/admin-payments-board";
import type { AdminPaymentTableRow } from "@/components/admin/admin-payments-data-table";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { AdminManualReviewBoard } from "@/components/admin/manual-review-board";
import { ExportButton } from "@/components/exports/export-button";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { paymentStatusesForChip, paymentsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { detectAnomalies, detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import { getAdminPaymentsKpiTrend } from "@/lib/data/http/admin-kpi-trends.server";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminManualReviewPayments } from "@/lib/data/http/admin.server";
import { buildPaymentsSummary } from "@/lib/data/view-models/admin-payments-summary.vm";
import { formatCompactMoney } from "@/lib/ui/format";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Suspense } from "react";

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
    success?: string;
  }>;
}) {
  const sp = await searchParams;
  const manualReviewQueue = sp.manualReview === "1";
  const success = sp.success ? decodeURIComponent(sp.success) : null;
  const periodDays = parseAdminKpiPeriod(sp.period);
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = paymentsListController.parseQuery(sp);

  const paymentsTrend = await getAdminPaymentsKpiTrend(periodDays).catch(() => ({
    currentTotal: 0,
    priorTotal: 0,
    dailyCounts: [] as number[],
  }));

  let manualReviewRows: Awaited<ReturnType<typeof getAdminManualReviewPayments>> = [];
  let manualReviewLoadError: string | null = null;
  if (manualReviewQueue) {
    try {
      manualReviewRows = await getAdminManualReviewPayments();
    } catch (e) {
      manualReviewLoadError =
        e instanceof Error ? e.message : "Could not load manual review payments.";
    }
  }

  let loadError: string | null = null;
  let paymentRows: AdminPaymentTableRow[] = [];
  let summaryRows: AdminPaymentTableRow[] = [];
  let total = 0;
  try {
    const result = await paymentsListController.fetch(query);
    paymentRows = result.rows;
    summaryRows = result.rowsForSummary ?? result.rows;
    total = result.total ?? summaryRows.length;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load payments.";
  }

  const summary = buildPaymentsSummary(summaryRows);
  let navCounts = EMPTY_ADMIN_NAV_COUNTS;
  try {
    navCounts = await getAdminNavCounts();
  } catch {
    /* use empty */
  }
  const paymentAnomalies = detectAnomaliesFromNavCounts(navCounts, {
    awaitingCaptureVolume: summary.pending,
    stalePendingPayments: summaryRows.filter((r) => r.status === "pending").length,
  });

  const statusChips = (
    <FilterChipRow
      label="Filter by payment status"
      chips={[
        {
          id: "manual-review",
          label: "Manual review",
          href: buildListHref("/admin/payments", sp, {
            manualReview: "1",
            status: "",
            offset: 0,
          }),
          active: manualReviewQueue,
        },
        ...paymentStatusesForChip.map((s) => ({
          id: s,
          label: s,
          href: buildListHref("/admin/payments", sp, {
            status: s === "all" ? "" : s,
            manualReview: "",
            offset: 0,
          }),
          active:
            !manualReviewQueue &&
            ((s === "all" && query.status === undefined) || query.status === s),
        })),
      ]}
    />
  );

  if (manualReviewQueue) {
    const manualAnomalies = detectAnomalies(
      { manualReviewCount: manualReviewRows.length },
      { manualReviewCount: 0 },
    );
    return (
      <AdminListPage
        variant="queue"
        title="Manual payment review"
        description="Winning payments paused because the seller entity was archived before capture."
        hasFilters={manualReviewQueue}
        resetHref="/admin/payments"
        chips={statusChips}
        errorAlert={
          error || manualReviewLoadError ? (
            <AdminListAlert title="Could not complete action">
              {manualReviewLoadError ?? error}
            </AdminListAlert>
          ) : null
        }
        kpiStrip={
          manualAnomalies.length > 0 ? (
            <AdminAnomalyBanner anomalies={manualAnomalies} storageKey="manual-review" />
          ) : null
        }
        view={
          !manualReviewLoadError && (success || manualReviewRows.length > 0) ? (
            <div className="space-y-4">
              {success ? (
                <Alert>
                  <AlertTitle>Done</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              ) : null}
              {manualReviewRows.length > 0 ? (
                <AdminManualReviewBoard rows={manualReviewRows} />
              ) : null}
            </div>
          ) : null
        }
        empty={
          !manualReviewLoadError && manualReviewRows.length === 0 ? (
            <AdminEmptyState
              title="No manual review payments"
              description="Archived-seller winning payments will appear here before capture."
            />
          ) : null
        }
        pagination={null}
      />
    );
  }

  const errorAlert =
    error || loadError ? (
      <AdminListAlert title="Could not load payments">{loadError ?? error}</AdminListAlert>
    ) : null;

  const empty =
    !loadError && summaryRows.length === 0 ? (
      <AdminEmptyState
        title="No payments"
        description="No payment records match the current filters."
      />
    ) : null;

  const view =
    !loadError && summaryRows.length > 0 ? (
      <Suspense fallback={<PageSkeleton variant="table" />}>
        <AdminPaymentsBoard rows={paymentRows} />
      </Suspense>
    ) : null;

  const paymentQ = query.q ?? "";

  return (
    <AdminListPage
      title="Payments"
      description="Filter by status, search payments, and use the drawer for capture/refund on touch devices."
      hasFilters={Boolean(query.status || paymentQ)}
      resetHref="/admin/payments"
      filters={
        <AdminListSearchGet
          action="/admin/payments"
          defaultValue={paymentQ}
          placeholder="Search lot, buyer, or payment id…"
          {...(query.status ? { hiddenFields: { status: String(sp.status) } } : {})}
        />
      }
      errorAlert={errorAlert}
      kpiStrip={
        !loadError && summaryRows.length > 0 ? (
          <>
            {paymentAnomalies.length > 0 ? (
              <AdminAnomalyBanner anomalies={paymentAnomalies} storageKey="payments" />
            ) : null}
            <AdminTrendKpiBand
              ariaLabel="Payments summary"
              tiles={[
                {
                  label: "Total volume",
                  value: formatCompactMoney(summary.totalVolume),
                  compareHint: "Loaded rows",
                  emphasize: true,
                },
                buildTrendKpiTile("Payment events", paymentsTrend, periodDays, {
                  trendTone: "primary",
                }),
                {
                  label: "Awaiting action",
                  value: formatCompactMoney(summary.pending),
                  compareHint: "Pending + authorized",
                  trendTone: "live-red",
                },
                {
                  label: "Settled",
                  value: formatCompactMoney(summary.captured),
                  compareHint: "Captured",
                  trendTone: "primary",
                },
              ]}
            />
          </>
        ) : null
      }
      chips={statusChips}
      listToolbarEnd={
        <ExportButton
          entityType="payments"
          disabled={Boolean(query.q?.trim())}
          disabledReason="Clear search to export all payments matching the status filters"
          filters={{
            ...(query.status ? { status: query.status } : {}),
            ...(manualReviewQueue ? { manualReview: true } : {}),
          }}
        />
      }
      view={view}
      empty={empty}
      pagination={
        !loadError && total > 0 ? (
          <PaginationFooter
            offset={query.offset}
            limit={query.limit}
            countOnPage={paymentRows.length}
            total={total}
            prevHref={
              query.offset > 0
                ? buildListHref("/admin/payments", sp, {
                    offset: Math.max(0, query.offset - query.limit),
                  })
                : null
            }
            nextHref={
              query.offset + paymentRows.length < total
                ? buildListHref("/admin/payments", sp, {
                    offset: query.offset + query.limit,
                  })
                : null
            }
          />
        ) : null
      }
    />
  );
}
