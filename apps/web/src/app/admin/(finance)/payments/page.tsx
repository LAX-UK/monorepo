import { AdminAnomalyBanner } from "@/components/admin/admin-anomaly-banner";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { AdminPaymentsBoard } from "@/components/admin/admin-payments-board";
import type { AdminPaymentTableRow } from "@/components/admin/admin-payments-data-table";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogKpiPeriodToggle } from "@/components/admin/catalog/catalog-kpi-period-toggle";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { PaymentsFilterToolbar } from "@/components/admin/finance/payments-filter-toolbar";
import { AdminManualReviewBoard } from "@/components/admin/manual-review-board";
import { ExportButton } from "@/components/exports/export-button";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { paymentStatusesForChip, paymentsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { detectAnomalies, detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import { isComplianceManualReviewReason } from "@/lib/admin/compliance-manual-review";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminPaymentsKpiTrend } from "@/lib/data/http/admin-kpi-trends.server";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminManualReviewPayments, getAdminUsersByIds } from "@/lib/data/http/admin.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { buildPaymentsSummary } from "@/lib/data/view-models/admin-payments-summary.vm";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { formatCompactMoney } from "@/lib/ui/format";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Payments",
  "Capture, review, and reconcile buyer payments.",
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
  const manualReviewQueue = sp.manualReview === "1";
  const manualReviewReasonFilter = sp.manualReviewReason?.trim() || "";
  const success = safeDecodeAdminErrorParam(sp.success);
  const periodDays = parseAdminKpiPeriod(sp.period);
  const error = safeDecodeAdminErrorParam(sp.error);
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
      const all = await getAdminManualReviewPayments();
      manualReviewRows =
        manualReviewReasonFilter === "finance"
          ? all.filter((r) => !isComplianceManualReviewReason(r.manualReviewReason))
          : manualReviewReasonFilter === "compliance"
            ? all.filter((r) => isComplianceManualReviewReason(r.manualReviewReason))
            : manualReviewReasonFilter.length > 0
              ? all.filter((r) => r.manualReviewReason === manualReviewReasonFilter)
              : all;
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

  const buyerIds = [...new Set(paymentRows.map((row) => row.buyerId).filter(Boolean))];
  const buyers = await getAdminUsersByIds(buyerIds).catch(() => []);
  const buyerLabels = new Map(buyers.map((b) => [b.id, b.name || b.email || null]));
  paymentRows = paymentRows.map((row) => ({
    ...row,
    buyerLabel: row.buyerLabel ?? buyerLabels.get(row.buyerId) ?? null,
  }));
  summaryRows = summaryRows.map((row) => ({
    ...row,
    buyerLabel: row.buyerLabel ?? buyerLabels.get(row.buyerId) ?? null,
  }));

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
            manualReviewReason: "",
            status: "",
            offset: 0,
          }),
          active: manualReviewQueue && !manualReviewReasonFilter,
        },
        {
          id: "manual-review-finance",
          label: "Finance",
          href: buildListHref("/admin/payments", sp, {
            manualReview: "1",
            manualReviewReason: "finance",
            status: "",
            offset: 0,
          }),
          active: manualReviewQueue && manualReviewReasonFilter === "finance",
        },
        {
          id: "manual-review-compliance",
          label: "Compliance",
          href: buildListHref("/admin/payments", sp, {
            manualReview: "1",
            manualReviewReason: "compliance",
            status: "",
            offset: 0,
          }),
          active: manualReviewQueue && manualReviewReasonFilter === "compliance",
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
    const sessionUser = await getServerSessionUser();
    const canOpenComplianceQueues = sessionUser
      ? canAccessPlatformAdminRoutes(sessionUser.role as UserRole, sessionUser.staffRole ?? null)
      : false;
    const manualAnomalies = detectAnomalies(
      { manualReviewCount: manualReviewRows.length },
      { manualReviewCount: 0 },
    );
    return (
      <AdminListShell
        variant="queue"
        title="Manual payment review"
        description="Winning payments held before checkout: finance (archived seller, high value) or compliance (AML hold, source of funds). Compliance holds cannot be released until MLRO clears the case."
        hasFilters={manualReviewQueue}
        resetHref="/admin/payments?manualReview=1"
        chips={
          <>
            {statusChips}
            <FilterChipRow
              label="Filter by hold reason"
              chips={[
                {
                  id: "mr-all",
                  label: "All holds",
                  href: buildListHref("/admin/payments", sp, {
                    manualReview: "1",
                    manualReviewReason: "",
                    offset: 0,
                  }),
                  active: !manualReviewReasonFilter,
                },
                {
                  id: "mr-finance",
                  label: "Finance holds",
                  href: buildListHref("/admin/payments", sp, {
                    manualReview: "1",
                    manualReviewReason: "finance",
                    offset: 0,
                  }),
                  active: manualReviewReasonFilter === "finance",
                },
                {
                  id: "mr-compliance-all",
                  label: "Compliance holds",
                  href: buildListHref("/admin/payments", sp, {
                    manualReview: "1",
                    manualReviewReason: "compliance",
                    offset: 0,
                  }),
                  active: manualReviewReasonFilter === "compliance",
                },
                {
                  id: "mr-aml",
                  label: "AML hold",
                  href: buildListHref("/admin/payments", sp, {
                    manualReview: "1",
                    manualReviewReason: "aml_hold",
                    offset: 0,
                  }),
                  active: manualReviewReasonFilter === "aml_hold",
                },
                {
                  id: "mr-sof",
                  label: "Source of funds",
                  href: buildListHref("/admin/payments", sp, {
                    manualReview: "1",
                    manualReviewReason: "source_of_funds_required",
                    offset: 0,
                  }),
                  active: manualReviewReasonFilter === "source_of_funds_required",
                },
              ]}
            />
          </>
        }
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
        wrapView={false}
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
                <AdminManualReviewBoard
                  rows={manualReviewRows}
                  canOpenComplianceQueues={canOpenComplianceQueues}
                />
              ) : null}
            </div>
          ) : null
        }
        empty={
          !manualReviewLoadError && !success && manualReviewRows.length === 0 ? (
            <AdminEmptyState
              title="No manual review payments"
              description="Payments in requires_manual_review will appear here — finance or compliance holds."
            />
          ) : null
        }
      />
    );
  }

  const paymentQ = query.q ?? "";
  const searchFilterChips =
    paymentQ.trim().length > 0
      ? [
          {
            id: "q",
            label: `Search: ${paymentQ.trim()}`,
            clearHref: buildListHref("/admin/payments", sp, { q: "", offset: 0 }),
          },
        ]
      : [];

  const pagination =
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
    ) : null;

  return (
    <AdminListShell
      title="Payments"
      description="Filter by status, search payments, and use the drawer for capture/refund on touch devices."
      hasFilters={Boolean(query.status || paymentQ)}
      resetHref="/admin/payments"
      chips={statusChips}
      filters={
        <PaymentsFilterToolbar
          activeFilterChips={searchFilterChips}
          toolbarEnd={<CatalogKpiPeriodToggle current={periodDays} className="hidden lg:flex" />}
        />
      }
      filtersSelfContained
      listToolbarEnd={
        <ExportButton
          entityType="payments"
          disabled={Boolean(query.q?.trim())}
          disabledReason="Clear search to export all payments matching the status filters"
          filters={{
            ...(query.status ? { status: query.status } : {}),
          }}
        />
      }
      mobileSummary={
        !loadError && summaryRows.length > 0 ? (
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
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Could not load payments">{loadError ?? error}</AdminListAlert>
        ) : null
      }
      showCommandPaletteHint
      wrapView={false}
      view={
        !loadError && summaryRows.length > 0 ? (
          <Suspense fallback={<PageSkeleton variant="table" />}>
            <AdminPaymentsBoard rows={paymentRows} />
          </Suspense>
        ) : null
      }
      empty={
        !loadError && summaryRows.length === 0 ? (
          <AdminEmptyState
            title="No payments"
            description="No payment records match the current filters."
          />
        ) : null
      }
      pagination={pagination}
    />
  );
}
