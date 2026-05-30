import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminLotsBoard } from "@/components/admin/admin-lots-board";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogListCapBanner } from "@/components/admin/catalog/catalog-list-cap-banner";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogLotsFilterToolbar } from "@/components/admin/catalog/catalog-lots-filter-toolbar";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { LotFilterOptionsLoader } from "@/components/admin/lot-filter-options-loader";
import { AdminWithdrawalsBoard } from "@/components/admin/withdrawals-board";
import { ExportButton } from "@/components/exports/export-button";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { lotsListController } from "@/lib/admin/admin-list-controllers";
import { buildLotsListPageModel } from "@/lib/admin/build-lots-list-page-model";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import { buildConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAdminLotsKpiTrend } from "@/lib/data/http/admin-kpi-trends.server";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { getLotWithdrawalRequests } from "@/lib/data/http/admin.server";
import { toAdminLotTableRows } from "@/lib/data/view-models/admin-lots.vm";
import { LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { Button } from "@auction/ui";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default async function AdminLotsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    error?: string;
    view?: string;
    q?: string;
    artistId?: string;
    saleId?: string;
    categoryId?: string;
    sort?: string;
    limit?: string;
    offset?: string;
    period?: string;
    lens?: string;
    needsPhotos?: string;
  }>;
}) {
  const user = await requireAdminCapability(LOTS_ACCESS, "/admin/lots");
  const canManageAuction = userHasAccessTo(
    user.role as UserRole,
    user.staffRole ?? null,
    SALES_ACCESS,
  );
  const sp = await searchParams;
  const periodDays = parseAdminKpiPeriod(sp.period);
  const error = safeDecodeAdminErrorParam(sp.error);

  const navCountsResult = await getAdminNavCounts().catch(() => ({
    withdrawalsPending: 0,
    submissionsPending: 0,
    artistsPending: 0,
  }));
  const model = buildLotsListPageModel(sp, {
    withdrawalsPending: navCountsResult.withdrawalsPending,
  });
  const {
    query,
    activeLens,
    attentionLens,
    effectiveSort,
    effectiveStatus,
    viewPipeline,
    q,
    artistId,
    saleId,
    categoryId,
    advancedFilterCount,
    lenses,
    columnSort,
    listParamsForToggle,
    buildPaginationHref,
    exportFilters,
  } = model;

  const [lotResult, lotsTrendResult, withdrawalResult] = await Promise.allSettled([
    lotsListController.fetch(query),
    getAdminLotsKpiTrend(periodDays),
    attentionLens ? getLotWithdrawalRequests() : Promise.resolve([]),
  ]);

  const lotsTrend =
    lotsTrendResult.status === "fulfilled"
      ? lotsTrendResult.value
      : { currentTotal: 0, priorTotal: 0, dailyCounts: [] as number[] };

  const lotRows = lotResult.status === "fulfilled" ? lotResult.value.rows : [];
  const hasNextPage =
    lotResult.status === "fulfilled" ? (lotResult.value.hasNextPage ?? false) : false;
  const pageRows = lotRows;

  const withdrawalTasks = withdrawalResult.status === "fulfilled" ? withdrawalResult.value : [];
  const withdrawalLoadError =
    withdrawalResult.status === "rejected"
      ? withdrawalResult.reason instanceof Error
        ? withdrawalResult.reason.message
        : "Could not load withdrawal requests."
      : null;

  const nav = navCountsResult;

  const listError =
    lotResult.status === "rejected"
      ? lotResult.reason instanceof Error
        ? lotResult.reason.message
        : "Could not load lots."
      : null;

  const lotTableRows = toAdminLotTableRows(pageRows);
  const activeOnPage = lotTableRows.filter((r) => r.status === "active").length;
  const draftOnPage = lotTableRows.filter((r) => r.status === "draft").length;
  const connectRequiredByLotId =
    pageRows.length > 0 ? await buildConnectRequiredByLotId(pageRows) : undefined;

  const pagination =
    !listError && !viewPipeline && (query.offset > 0 || hasNextPage) ? (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={pageRows.length}
        prevHref={
          query.offset > 0
            ? buildPaginationHref({ offset: Math.max(0, query.offset - query.limit) })
            : null
        }
        nextHref={hasNextPage ? buildPaginationHref({ offset: query.offset + query.limit }) : null}
      />
    ) : null;

  const empty =
    !listError && !viewPipeline && lotRows.length === 0 ? (
      <AdminEmptyState
        title={q || activeLens !== "all" ? "No matching lots" : "No lots yet"}
        description={
          q || activeLens !== "all"
            ? "Try another lens or clear filters in More filters."
            : "Create the first draft lot and assign a seller."
        }
        action={
          !q && activeLens === "all" ? (
            <Button variant="default" asChild>
              <Link href="/admin/lots/new">
                <Plus className="size-4" aria-hidden />
                New lot
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" asChild>
              <Link href="/admin/lots">Clear filters</Link>
            </Button>
          )
        }
      />
    ) : null;

  const listParamsForToggleFromModel = listParamsForToggle;

  return (
    <CatalogListShell
      title="Lots"
      description="Publish, schedule, and triage catalogue lots."
      primaryAction={
        <Button variant="default" asChild>
          <Link href="/admin/lots/new">
            <Plus className="size-4" aria-hidden />
            New lot
          </Link>
        </Button>
      }
      filterBar={
        <CatalogLotsFilterToolbar
          lenses={lenses}
          activeLensId={activeLens}
          activeFilterCount={advancedFilterCount}
          sheetFilters={
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <LotFilterOptionsLoader
                {...(effectiveStatus ? { status: effectiveStatus } : {})}
                {...(q.trim() !== "" ? { q } : {})}
                {...(viewPipeline ? { viewPipeline: true } : {})}
                {...(artistId.trim() !== "" ? { artistId } : {})}
                {...(saleId.trim() !== "" ? { saleId } : {})}
                {...(categoryId.trim() !== "" ? { categoryId } : {})}
                {...(effectiveSort ? { sort: effectiveSort } : {})}
                lens={activeLens}
              />
            </Suspense>
          }
        />
      }
      mobileSummary={
        <CatalogListMobileSummary
          segments={[
            lotsTrend.currentTotal > 0 ? `${lotsTrend.currentTotal} new (${periodDays}d)` : null,
            `${lotTableRows.length} on page`,
            activeOnPage > 0 ? `${activeOnPage} live` : null,
            draftOnPage > 0 ? `${draftOnPage} draft` : null,
            attentionLens && nav.withdrawalsPending > 0
              ? `${nav.withdrawalsPending} need attention`
              : null,
          ]}
        />
      }
      kpiStrip={
        !viewPipeline && lotTableRows.length > 0 ? (
          <AdminTrendKpiBand
            ariaLabel="Lots summary"
            tiles={[
              buildTrendKpiTile("New lots", lotsTrend, periodDays, { emphasize: true }),
              {
                label: "On this page",
                value: String(lotTableRows.length),
                compareHint: `Live ${activeOnPage} · draft ${draftOnPage}`,
              },
              buildTrendKpiTile("Catalog activity", lotsTrend, periodDays, {
                trendTone: "secondary",
              }),
            ]}
          />
        ) : null
      }
      toolbarEnd={
        <>
          <Link
            href="/sales"
            className="min-h-11 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary underline-offset-4 hover:underline"
          >
            Public catalog
          </Link>
          <ExportButton entityType="lots" filters={exportFilters} />
        </>
      }
      errorAlert={
        error || listError ? (
          <AdminListAlert title="Could not load lots">{listError ?? error}</AdminListAlert>
        ) : null
      }
      empty={empty}
      pagination={pagination}
    >
      {attentionLens && withdrawalLoadError ? (
        <AdminListAlert title="Could not load withdrawals">{withdrawalLoadError}</AdminListAlert>
      ) : null}
      {attentionLens ? (
        <p className="font-body text-sm text-on-surface-variant">
          Export includes draft lots missing photos only; withdrawal requests are not included in
          exports.
        </p>
      ) : null}
      {attentionLens && !withdrawalLoadError && withdrawalTasks.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Withdrawal requests
          </h2>
          <AdminWithdrawalsBoard tasks={withdrawalTasks} />
        </section>
      ) : null}
      {attentionLens && lotTableRows.length > 0 ? (
        <h2 className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          Drafts missing photos
        </h2>
      ) : null}
      {viewPipeline && lotTableRows.length >= 200 ? (
        <CatalogListCapBanner message="Pipeline view shows up to 200 lots. Use Table view with filters for full pagination." />
      ) : null}
      {!listError && (viewPipeline || lotTableRows.length > 0) ? (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          <AdminLotsBoard
            rows={lotTableRows}
            fullLots={pageRows}
            viewPipeline={viewPipeline}
            listError={listError}
            urlError={error}
            searchQuery={q}
            listParams={listParamsForToggleFromModel}
            canManageAuction={canManageAuction}
            canManageCatalog={userHasAccessTo(
              user.role as UserRole,
              user.staffRole ?? null,
              LOTS_ACCESS,
            )}
            columnSort={columnSort}
            {...(connectRequiredByLotId ? { connectRequiredByLotId } : {})}
          />
        </Suspense>
      ) : null}
    </CatalogListShell>
  );
}
