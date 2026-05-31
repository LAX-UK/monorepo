import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogKpiPeriodToggle } from "@/components/admin/catalog/catalog-kpi-period-toggle";
import { CatalogListCapBanner } from "@/components/admin/catalog/catalog-list-cap-banner";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogLotsFilterToolbar } from "@/components/admin/catalog/catalog-lots-filter-toolbar";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { CatalogPrimaryCta } from "@/components/admin/catalog/catalog-primary-cta";
import { CatalogRelatedWork } from "@/components/admin/catalog/catalog-related-work";
import { CatalogWorkQueueSection } from "@/components/admin/catalog/catalog-work-queue-section";
import { LotFilterOptionsLoader } from "@/components/admin/lot-filter-options-loader";
import { AdminLotsBoard } from "@/components/admin/lots-board";
import { AdminWithdrawalsBoard } from "@/components/admin/withdrawals-board";
import { ExportButton } from "@/components/exports/export-button";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { lotsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildLotsListPageModel } from "@/lib/admin/build-lots-list-page-model";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import { buildLotsActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { buildConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAdminLotsKpiTrend } from "@/lib/data/http/admin-kpi-trends.server";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import {
  getAdminArtistById,
  getAdminCategoryById,
  getAdminSaleById,
  getLotWithdrawalRequests,
} from "@/lib/data/http/admin.server";
import { toAdminLotTableRows } from "@/lib/data/view-models/admin-lots.vm";
import { LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { Button } from "@auction/ui";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate("Lots", "Catalogue and manage auction lots.");

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

  const navCountsResult = await getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS);
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
  const lensOwnedSort = activeLens === "ending" && !sp.sort;

  const listError =
    lotResult.status === "rejected"
      ? lotResult.reason instanceof Error
        ? lotResult.reason.message
        : "Could not load lots."
      : null;

  const [artistRef, saleRef, categoryRef] = await Promise.all([
    artistId.trim() ? getAdminArtistById(artistId).catch(() => null) : null,
    saleId.trim() ? getAdminSaleById(saleId).catch(() => null) : null,
    categoryId.trim() ? getAdminCategoryById(categoryId).catch(() => null) : null,
  ]);

  const activeFilterChips = buildLotsActiveFilterChips(sp, {
    ...(q ? { q } : {}),
    ...(artistId ? { artistId, artistName: artistRef?.displayName ?? null } : {}),
    ...(saleId ? { saleId, saleTitle: saleRef?.sale.title ?? null } : {}),
    ...(categoryId ? { categoryId, categoryName: categoryRef?.name ?? null } : {}),
    ...(effectiveSort ? { sort: effectiveSort } : {}),
    ...(effectiveStatus ? { status: effectiveStatus } : {}),
    activeLens,
    lensOwnedSort,
  });

  const lotTableRows = toAdminLotTableRows(pageRows);
  const hasAttentionContent =
    attentionLens &&
    !withdrawalLoadError &&
    (withdrawalTasks.length > 0 || lotTableRows.length > 0);
  const activeOnPage = lotTableRows.filter((r) => r.status === "active").length;
  const draftOnPage = lotTableRows.filter((r) => r.status === "draft").length;
  const connectRequiredByLotId =
    pageRows.length > 0 ? await buildConnectRequiredByLotId(pageRows) : undefined;

  const pagination =
    !listError && (query.offset > 0 || hasNextPage) ? (
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
    !listError && !viewPipeline && lotRows.length === 0 && !hasAttentionContent ? (
      <CatalogListEmptyState
        title={q || activeLens !== "all" ? "No matching lots" : "No lots yet"}
        description={
          q || activeLens !== "all"
            ? "Try another lens or clear filters in More filters."
            : "Create the first draft lot and assign a seller."
        }
        action={
          !q && activeLens === "all" ? (
            <CatalogPrimaryCta href="/admin/lots/new" icon={Plus}>
              New lot
            </CatalogPrimaryCta>
          ) : (
            <Button variant="secondary" asChild>
              <Link href="/admin/lots">Clear filters</Link>
            </Button>
          )
        }
      />
    ) : null;

  const relatedExtra =
    !attentionLens && nav.draftLotsMissingPhotos > 0
      ? {
          label: `${nav.draftLotsMissingPhotos} drafts missing photos`,
          href: "/admin/lots?lens=attention",
        }
      : null;

  const listParamsForToggleFromModel = listParamsForToggle;

  return (
    <CatalogListShell
      title="Lots"
      description="Publish, schedule, and triage catalogue lots."
      meta={<CatalogRelatedWork variant="lots" navCounts={nav} extra={relatedExtra} />}
      primaryAction={
        <CatalogPrimaryCta href="/admin/lots/new" icon={Plus}>
          New lot
        </CatalogPrimaryCta>
      }
      filterBar={
        <CatalogLotsFilterToolbar
          lenses={lenses}
          activeLensId={activeLens}
          activeFilterCount={advancedFilterCount}
          activeFilterChips={activeFilterChips}
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
          metrics={[
            {
              id: "new",
              label: `New (${periodDays}d)`,
              value: String(lotsTrend.currentTotal),
            },
            { id: "page", label: "On page", value: String(lotTableRows.length) },
            ...(activeOnPage > 0
              ? [{ id: "live", label: "Live", value: String(activeOnPage) }]
              : []),
            ...(draftOnPage > 0
              ? [{ id: "draft", label: "Draft", value: String(draftOnPage) }]
              : []),
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
              buildTrendKpiTile("New lots trend", lotsTrend, periodDays, {
                trendTone: "secondary",
              }),
            ]}
          />
        ) : null
      }
      toolbarEnd={
        <>
          <CatalogKpiPeriodToggle current={periodDays} className="hidden md:flex" />
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
        <div className="space-y-4">
          <p className="font-body text-sm text-on-surface-variant">
            Export includes draft lots missing photos only; withdrawal requests are not included in
            exports.
          </p>
          {!withdrawalLoadError && withdrawalTasks.length > 0 ? (
            <CatalogWorkQueueSection
              id="withdrawals"
              title="Withdrawal requests"
              count={withdrawalTasks.length}
              primaryAction={{ label: "View all lots", href: "/admin/lots" }}
            >
              <AdminWithdrawalsBoard tasks={withdrawalTasks} />
            </CatalogWorkQueueSection>
          ) : null}
          {lotTableRows.length > 0 ? (
            <CatalogWorkQueueSection
              id="drafts-missing-photos"
              title="Drafts missing photos"
              count={lotTableRows.length}
              defaultOpen
            >
              <p className="font-body text-sm text-on-surface-variant">
                Add catalogue images before publishing these draft lots.
              </p>
              {!listError ? (
                <Suspense fallback={<PageSkeleton variant="table" />}>
                  <AdminLotsBoard
                    rows={lotTableRows}
                    fullLots={pageRows}
                    viewPipeline={false}
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
            </CatalogWorkQueueSection>
          ) : null}
        </div>
      ) : null}
      {viewPipeline && hasNextPage && query.offset === 0 && lotTableRows.length >= 200 ? (
        <CatalogListCapBanner
          message="Pipeline view loads 200 lots per page. Use pagination below or switch to Table view for exports."
          actionHref={buildListHref("/admin/lots", sp, { view: "", offset: 0 })}
          actionLabel="Open table view"
        />
      ) : null}
      {!listError && !attentionLens && (viewPipeline || lotTableRows.length > 0) ? (
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
