import { AdminAnomalyBanner } from "@/components/admin/admin-anomaly-banner";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogKpiPeriodToggle } from "@/components/admin/catalog/catalog-kpi-period-toggle";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { PayoutsFilterToolbar } from "@/components/admin/finance/payouts-filter-toolbar";
import { AdminPayoutsBoard } from "@/components/admin/payouts-board";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { payoutsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import { summarizeSettlementReadiness } from "@/lib/admin/payout-settlement-readiness.vm";
import {
  buildPayoutsActiveFilterChips,
  countPayoutsListActiveFilters,
  hasPayoutsListActiveFilters,
  parsePayoutsListFilters,
} from "@/lib/admin/payouts-list-query";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminPayoutsKpiTrend } from "@/lib/data/http/admin-kpi-trends.server";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import type { AdminPayoutRow } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { formatMoney } from "@/lib/ui/format";
import { payoutStatuses } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Surface } from "@auction/ui/components/surface";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

const filters = ["all", ...payoutStatuses] as const;
const BASE_PATH = "/admin/payouts";

export const metadata: Metadata = metadataForPrivate(
  "Payouts",
  "Run seller settlements, review payout totals, and reconcile Stripe transfers.",
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
  }>;
}) {
  const sp = await searchParams;

  if (sp.settlement === "1") {
    redirect("/admin/payouts/settlement");
  }

  const periodDays = parseAdminKpiPeriod(sp.period);
  const query = payoutsListController.parseQuery(sp);
  const listFilters = parsePayoutsListFilters(sp);
  const hasFilters = hasPayoutsListActiveFilters(listFilters);
  const activeFilterCount = countPayoutsListActiveFilters(listFilters);
  const activeFilterChips = buildPayoutsActiveFilterChips(BASE_PATH, sp, listFilters);
  const success = safeDecodeAdminErrorParam(sp.success);
  const error = safeDecodeAdminErrorParam(sp.error);

  const payoutsTrend = await getAdminPayoutsKpiTrend(periodDays).catch(() => ({
    currentTotal: 0,
    priorTotal: 0,
    dailyCounts: [] as number[],
  }));

  let payouts: AdminPayoutRow[] = [];
  let summaryPayouts: AdminPayoutRow[] = [];
  let hasNextPage = false;
  let loadError: string | null = null;
  try {
    const result = await payoutsListController.fetch(query);
    payouts = result.rows;
    summaryPayouts = result.rowsForSummary ?? result.rows;
    hasNextPage = result.hasNextPage ?? false;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load payouts.";
  }

  const scheduled = summaryPayouts.filter((p) => p.status === "scheduled").length;
  const inTransit = summaryPayouts.filter((p) => p.status === "in_transit").length;
  const clawbackPending = summaryPayouts.filter((p) => p.status === "clawback_pending").length;
  const paid = summaryPayouts.filter((p) => p.status === "paid").length;
  const totalNet = summaryPayouts.reduce(
    (sum, p) => sum + Number.parseFloat(p.netAmount || "0"),
    0,
  );
  const readiness = summarizeSettlementReadiness(summaryPayouts);
  let navCounts = EMPTY_ADMIN_NAV_COUNTS;
  try {
    navCounts = await getAdminNavCounts();
  } catch {
    /* use empty */
  }
  const payoutAnomalies = detectAnomaliesFromNavCounts(navCounts, {
    clawbackPending,
    failedPayouts: readiness.failedCount + readiness.reversedCount,
  });
  const showSettlementReadiness =
    query.status === undefined && !loadError && summaryPayouts.length > 0;

  const statusChips = (
    <FilterChipRow
      label="Payout status"
      chips={filters.map((filter) => ({
        id: filter,
        label: filter.replaceAll("_", " "),
        href: buildListHref(BASE_PATH, sp, {
          status: filter === "all" ? "" : filter,
          offset: 0,
        }),
        active: (filter === "all" && query.status === undefined) || query.status === filter,
      }))}
    />
  );

  const kpiStrip = !loadError ? (
    <>
      {payoutAnomalies.length > 0 ? (
        <AdminAnomalyBanner anomalies={payoutAnomalies} storageKey="payouts" />
      ) : null}
      <AdminTrendKpiBand
        ariaLabel="Payouts summary"
        tiles={[
          buildTrendKpiTile("Payout events", payoutsTrend, periodDays, { emphasize: true }),
          { label: "Scheduled", value: String(scheduled), compareHint: "First 100 rows" },
          { label: "In transit", value: String(inTransit), compareHint: "First 100 rows" },
          {
            label: "Visible net",
            value: formatMoney(totalNet.toFixed(2), "GBP"),
            compareHint: `${paid} paid`,
          },
        ]}
      />
      <p className="text-xs text-on-surface-variant">
        KPIs reflect the first 100 payouts for the current filters. The list below uses your page
        size and offset.
      </p>
    </>
  ) : null;

  const settlementBand = showSettlementReadiness ? (
    <Surface variant="card">
      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <h2 className="font-heading text-lg">Settlement readiness</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Snapshot from the same first-100 slice as the KPIs. Hidden while a status filter is on.
          </p>
        </div>
        <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <li className="rounded-md bg-surface-container-low px-3 py-2">
            <span className="text-on-surface-variant">In flight (scheduled + in transit)</span>
            <p className="text-lg font-semibold">{readiness.inFlightCount}</p>
          </li>
          <li className="rounded-md bg-surface-container-low px-3 py-2">
            <span className="text-on-surface-variant">Missing Stripe transfer ID</span>
            <p className="text-lg font-semibold">{readiness.missingTransferRefCount}</p>
          </li>
          <li className="rounded-md bg-surface-container-low px-3 py-2">
            <span className="text-on-surface-variant">Payouts with blockers</span>
            <p className="text-lg font-semibold">{readiness.blockerPayoutCount}</p>
          </li>
          <li className="rounded-md bg-surface-container-low px-3 py-2">
            <span className="text-on-surface-variant">Stripe failure reason</span>
            <p className="text-lg font-semibold">{readiness.withFailureReasonCount}</p>
          </li>
          <li className="rounded-md bg-surface-container-low px-3 py-2">
            <span className="text-on-surface-variant">Statement PDF errors</span>
            <p className="text-lg font-semibold">{readiness.withStatementErrorCount}</p>
          </li>
          <li className="rounded-md bg-surface-container-low px-3 py-2">
            <span className="text-on-surface-variant">Failed / reversed / clawback</span>
            <p className="text-lg font-semibold">
              {readiness.failedCount} / {readiness.reversedCount} / {readiness.clawbackCount}
            </p>
          </li>
        </ul>
      </div>
    </Surface>
  ) : null;

  const pagination =
    !loadError && (query.offset > 0 || hasNextPage) ? (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={payouts.length}
        prevHref={
          query.offset > 0
            ? buildListHref(BASE_PATH, sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          hasNextPage ? buildListHref(BASE_PATH, sp, { offset: query.offset + query.limit }) : null
        }
      />
    ) : null;

  return (
    <AdminListShell
      title="Payouts"
      description="Run seller settlements, review payout totals, add finance adjustments, and mark Stripe transfers as paid."
      primaryAction={
        <Link
          href="/admin/payouts/settlement"
          className="inline-flex min-h-9 items-center rounded-md bg-primary px-4 py-2 font-label text-xs font-semibold text-on-primary"
        >
          Run settlement
        </Link>
      }
      hasFilters={hasFilters}
      resetHref={BASE_PATH}
      chips={statusChips}
      filters={
        !loadError ? (
          <PayoutsFilterToolbar
            {...(listFilters.legalEntityId ? { legalEntityId: listFilters.legalEntityId } : {})}
            {...(query.status ? { status: query.status } : {})}
            activeFilterCount={activeFilterCount}
            activeFilterChips={activeFilterChips}
            toolbarEnd={<CatalogKpiPeriodToggle current={periodDays} className="hidden lg:flex" />}
          />
        ) : null
      }
      filtersSelfContained
      mobileSummary={
        !loadError ? (
          <div className="space-y-3">
            <CatalogListMobileSummary
              metrics={[
                { id: "scheduled", label: "Scheduled", value: String(scheduled) },
                { id: "transit", label: "In transit", value: String(inTransit) },
                {
                  id: "net",
                  label: "Visible net",
                  value: formatMoney(totalNet.toFixed(2), "GBP"),
                },
              ]}
            />
            <CatalogKpiPeriodToggle current={periodDays} className="lg:hidden" />
          </div>
        ) : null
      }
      kpiStrip={kpiStrip}
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Could not complete action">{loadError ?? error}</AdminListAlert>
        ) : null
      }
      wrapView={false}
      view={
        !loadError && payouts.length > 0 ? (
          <div className="space-y-6">
            {success ? (
              <Alert>
                <AlertTitle>Done</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            ) : null}
            {settlementBand}
            <AdminPayoutsBoard rows={payouts} />
          </div>
        ) : null
      }
      empty={
        !loadError && payouts.length === 0 ? (
          <AdminEmptyState
            title="No payouts found"
            description="Run settlement for a legal entity once captured payments are ready."
          />
        ) : null
      }
      pagination={pagination}
    />
  );
}
