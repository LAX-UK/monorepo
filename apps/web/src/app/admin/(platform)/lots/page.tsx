import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogKpiPeriodToggle } from "@/components/admin/catalog/catalog-kpi-period-toggle";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";
import { CatalogLotsStickyFilterToolbar } from "@/components/admin/catalog/catalog-lots-filter-toolbar";
import { CatalogPrimaryCta } from "@/components/admin/catalog/catalog-primary-cta";
import { CatalogWorkQueueSection } from "@/components/admin/catalog/catalog-work-queue-section";
import { AdminLotsBoard } from "@/components/admin/lots-board";
import {
  LotsBoardStatusQuickFilter,
  LotsBoardStatusQuickFilterMobile,
} from "@/components/admin/lots-board/status-quick-filter";
import { AdminWithdrawalsBoard } from "@/components/admin/withdrawals-board";
import { buildListHref } from "@/lib/admin/admin-list-params";
import {
  buildLotsBoardStatusChips,
  lotsBoardQuickStatus,
} from "@/lib/admin/lots/build-lots-board-status-chips";
import { buildLotsListKpiTiles } from "@/lib/admin/lots/build-lots-list-kpi-tiles";
import { loadAdminLotsListPage } from "@/lib/admin/lots/load-lots-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { formatMoney } from "@/lib/ui/format";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { Button } from "@auction/ui";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
  if (sp.view === "pipeline") {
    redirect(buildListHref("/admin/lots", sp, { view: "", offset: 0 }));
  }
  const error = safeDecodeAdminErrorParam(sp.error);
  const vm = await loadAdminLotsListPage(sp);
  const {
    periodDays,
    model,
    lotsSummary,
    lotsTrend,
    lotsEndedTrend,
    listError,
    pageRows,
    lotTableRows,
    hasNextPage,
    listPaginationTotal,
    withdrawalTasks,
    withdrawalLoadError,
    lensesItems,
    activeFilterChips,
    lotFilterOptions,
    connectRequiredByLotId,
    hasAttentionContent,
  } = vm;
  const {
    query,
    activeLens,
    attentionLens,
    effectiveSort,
    hasListFilters,
    lotsEmptyDescription,
    columnSort,
    buildPaginationHref,
    exportFilters,
  } = model;

  const boardPagination =
    !listError && (query.offset > 0 || hasNextPage)
      ? {
          offset: query.offset,
          limit: query.limit,
          countOnPage: pageRows.length,
          ...(listPaginationTotal !== undefined ? { total: listPaginationTotal } : {}),
          prevHref:
            query.offset > 0
              ? buildPaginationHref({ offset: Math.max(0, query.offset - query.limit) })
              : null,
          nextHref: hasNextPage
            ? buildPaginationHref({ offset: query.offset + query.limit })
            : null,
        }
      : null;

  const boardFilterControls = {
    searchPlaceholder: "Search lots…",
    sheetTitle: "Lot filters",
    activeFilterCount: model.advancedFilterCount,
    searchInputId: "admin-lots-table-search",
  };

  const lotFilterSheet = {
    ...(model.artistId.trim() !== "" ? { artistId: model.artistId } : {}),
    ...(model.saleId.trim() !== "" ? { saleId: model.saleId } : {}),
    ...(model.categoryId.trim() !== "" ? { categoryId: model.categoryId } : {}),
    ...(effectiveSort ? { sort: effectiveSort } : {}),
    ...(activeLens && activeLens !== "all" ? { lens: activeLens } : {}),
  };

  const empty =
    !listError && pageRows.length === 0 && !hasAttentionContent ? (
      <CatalogListEmptyState
        title={hasListFilters ? "No matching lots" : "No lots yet"}
        description={
          hasListFilters ? lotsEmptyDescription : "Create the first draft lot and assign a seller."
        }
        action={
          hasListFilters ? (
            <Button variant="secondary" asChild>
              <Link href="/admin/lots">Clear filters</Link>
            </Button>
          ) : (
            <CatalogPrimaryCta href="/admin/lots/new" icon={Plus}>
              New lot
            </CatalogPrimaryCta>
          )
        }
      />
    ) : null;

  const kpiStrip = (
    <AdminTrendKpiBand
      ariaLabel="Lots summary"
      tiles={buildLotsListKpiTiles({
        summary: lotsSummary,
        lotsTrend,
        lotsEndedTrend,
        periodDays,
      })}
      toolbarEnd={<CatalogKpiPeriodToggle current={periodDays} />}
    />
  );

  const quickStatus = lotsBoardQuickStatus(sp);
  const statusQuickFilterChips = buildLotsBoardStatusChips(sp, quickStatus);
  const statusQuickFilterDesktop = <LotsBoardStatusQuickFilter chips={statusQuickFilterChips} />;
  const statusQuickFilterMobile = (
    <LotsBoardStatusQuickFilterMobile chips={statusQuickFilterChips} />
  );

  const boardProps = {
    rows: lotTableRows,
    fullLots: pageRows,
    listError,
    urlError: error,
    canManageAuction,
    canManageCatalog: userHasAccessTo(user.role as UserRole, user.staffRole ?? null, LOTS_ACCESS),
    columnSort,
    filterControls: boardFilterControls,
    lotFilterSheet,
    lotFilterOptions,
    exportFilters,
    pagination: boardPagination,
    statusQuickFilter: statusQuickFilterDesktop,
    statusQuickFilterMobile,
    listTotalCount: listPaginationTotal ?? lotsSummary.lensCounts.all,
    ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
  };

  return (
    <CatalogListShell
      title="Lots"
      description="Publish, schedule, and triage catalogue lots."
      breadcrumbs={
        <CatalogBreadcrumbs segments={[{ label: "Admin", href: "/admin" }, { label: "Lots" }]} />
      }
      primaryAction={
        <CatalogPrimaryCta href="/admin/lots/new" icon={Plus}>
          New lot
        </CatalogPrimaryCta>
      }
      filterBar={
        <CatalogLotsStickyFilterToolbar
          lenses={lensesItems}
          activeLensId={activeLens}
          activeFilterChips={activeFilterChips}
        />
      }
      mobileSummary={
        <div className="space-y-3">
          <CatalogListMobileSummary
            metrics={[
              {
                id: "new",
                label: `New (${periodDays}d)`,
                value: String(lotsTrend.currentTotal),
              },
              { id: "live", label: "Live", value: String(lotsSummary.liveCount) },
              { id: "draft", label: "Draft", value: String(lotsSummary.draftCount) },
              {
                id: "hammer",
                label: "Hammer",
                value: formatMoney(lotsSummary.totalHammerValue),
              },
            ]}
          />
          <CatalogKpiPeriodToggle current={periodDays} className="lg:hidden" />
        </div>
      }
      kpiStrip={kpiStrip}
      errorAlert={
        error || listError ? (
          <AdminListAlert title="Could not load lots">{listError ?? error}</AdminListAlert>
        ) : null
      }
      empty={empty}
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
                <Suspense fallback={<CatalogListPageSkeleton title="Lots" kpiTiles={6} />}>
                  <AdminLotsBoard {...boardProps} />
                </Suspense>
              ) : null}
            </CatalogWorkQueueSection>
          ) : null}
        </div>
      ) : null}
      {!listError && !attentionLens && lotTableRows.length > 0 ? (
        <Suspense fallback={<CatalogListPageSkeleton title="Lots" kpiTiles={6} />}>
          <AdminLotsBoard {...boardProps} />
        </Suspense>
      ) : null}
    </CatalogListShell>
  );
}
