import "server-only";

import { type AdminKpiPeriodDays, parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { lotsListController } from "@/lib/admin/admin-list-controllers";
import { applyLotsLensBadges } from "@/lib/admin/apply-lots-lens-badges";
import {
  type LotsListSearchParams,
  buildLotsListPageModel,
} from "@/lib/admin/build-lots-list-page-model";
import { buildLotsActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import type { AdminLotTableRow } from "@/lib/admin/catalog/lot-table-row";
import { connectRequiredFromLots } from "@/lib/admin/connect-readiness";
import { resolveLotsListPaginationTotal } from "@/lib/admin/resolve-catalog-list-pagination-total";
import { withdrawalsListController } from "@/lib/admin/withdrawals-list-controller";
import {
  getAdminLotsEndedKpiTrend,
  getAdminLotsHammerKpiTrend,
  getAdminLotsKpiTrend,
  getAdminLotsLiveKpiTrend,
} from "@/lib/data/http/admin-kpi-trends.server";
import {
  type AdminLotsListSummary,
  EMPTY_ADMIN_LOTS_LIST_SUMMARY,
  getAdminLotsListSummary,
} from "@/lib/data/http/admin-lots-summary.server";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import {
  type AdminNavCounts,
  EMPTY_ADMIN_NAV_COUNTS,
} from "@/lib/data/http/admin-nav-counts.types";
import {
  getAdminArtistById,
  getAdminArtistList,
  getAdminCategoryById,
  getAdminLotDetail,
  getAdminSaleById,
  getAdminSalesList,
} from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import {
  type AdminLotSaleContext,
  toAdminLotTableRows,
} from "@/lib/data/view-models/admin-lots.vm";
import type { CategoryNode } from "@auction/types";

type LotListRow = Awaited<ReturnType<typeof lotsListController.fetch>>["rows"][number];

export type AdminLotsListPageViewModel = {
  periodDays: AdminKpiPeriodDays;
  model: ReturnType<typeof buildLotsListPageModel>;
  lotsSummary: AdminLotsListSummary;
  lotsTrend: Awaited<ReturnType<typeof getAdminLotsKpiTrend>>;
  lotsEndedTrend: Awaited<ReturnType<typeof getAdminLotsEndedKpiTrend>>;
  /** Hammer of lots ended each day over the period, with the period before; null if unavailable. */
  hammerTrend: Awaited<ReturnType<typeof getAdminLotsHammerKpiTrend>> | null;
  /** Lots open for bidding each day over the period; null if unavailable. */
  liveTrend: Awaited<ReturnType<typeof getAdminLotsLiveKpiTrend>> | null;
  navCounts: AdminNavCounts;
  listError: string | null;
  pageRows: LotListRow[];
  lotTableRows: AdminLotTableRow[];
  hasNextPage: boolean;
  listPaginationTotal: number | undefined;
  withdrawalTasks: Awaited<ReturnType<typeof withdrawalsListController.fetch>>["tasks"];
  withdrawalLoadError: string | null;
  lensesItems: ReturnType<typeof applyLotsLensBadges>;
  activeFilterChips: ReturnType<typeof buildLotsActiveFilterChips>;
  lotFilterOptions: {
    artists: Awaited<ReturnType<typeof getAdminArtistList>>["rows"];
    sales: Awaited<ReturnType<typeof getAdminSalesList>>[number]["sale"][];
    categories: CategoryNode[];
  };
  connectRequiredByLotId: ReturnType<typeof connectRequiredFromLots> | undefined;
  hasAttentionContent: boolean;
  hasFiltersBeyondLens: boolean;
  /** When each lot with a pending seller withdrawal request asked (ISO), by lot id. */
  withdrawalRequestedAt: Record<string, string>;
};

type WithdrawalTasks = Awaited<ReturnType<typeof withdrawalsListController.fetch>>["tasks"];

/** The lots behind pending withdrawal requests, in the order the requests came in. */
async function lotsForWithdrawalRequests(tasks: WithdrawalTasks): Promise<LotListRow[]> {
  const ids = [
    ...new Set(tasks.map((task) => task.targetLotId).filter((id): id is string => Boolean(id))),
  ];
  const details = await Promise.all(ids.map((id) => getAdminLotDetail(id).catch(() => null)));
  return details
    .filter((detail): detail is NonNullable<typeof detail> => detail !== null)
    .map((detail) => ({ ...detail.auction, deleteEligibility: detail.deleteEligibility }));
}

export async function loadAdminLotsListPage(
  sp: LotsListSearchParams,
): Promise<AdminLotsListPageViewModel> {
  const periodDays = parseAdminKpiPeriod(sp.period);
  const navCountsResult = await getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS);
  const model = buildLotsListPageModel(sp, {
    withdrawalsPending: navCountsResult.withdrawalsPending,
  });
  const {
    query,
    activeLens,
    withdrawalsLens,
    effectiveSort,
    effectiveStatus,
    q,
    artistId,
    saleId,
    categoryId,
    lenses,
  } = model;

  // Pending withdrawal requests mark their lots on every view; the requests view lists them.
  const withdrawalResult = await withdrawalsListController.fetch().then(
    (r) => ({ err: null as string | null, tasks: r.tasks }),
    (e) => ({
      err: e instanceof Error ? e.message : "Could not load withdrawal requests.",
      tasks: [] as WithdrawalTasks,
    }),
  );

  const [
    lotsSummary,
    lotResult,
    lotsTrendResult,
    lotsEndedTrendResult,
    hammerTrendResult,
    liveTrendResult,
  ] = await Promise.all([
    getAdminLotsListSummary().catch(() => EMPTY_ADMIN_LOTS_LIST_SUMMARY),
    (withdrawalsLens
      ? lotsForWithdrawalRequests(withdrawalResult.tasks).then((rows) => ({
          rows,
          hasNextPage: false,
          offset: 0,
          limit: query.limit,
        }))
      : lotsListController.fetch(query)
    ).then(
      (r) => ({ err: null as string | null, ...r }),
      (e) => ({
        err: e instanceof Error ? e.message : "Could not load lots.",
        rows: [] as LotListRow[],
        hasNextPage: false,
        offset: query.offset,
        limit: query.limit,
      }),
    ),
    getAdminLotsKpiTrend(periodDays).catch(() => ({
      currentTotal: 0,
      priorTotal: 0,
      dailyCounts: [] as number[],
    })),
    getAdminLotsEndedKpiTrend(periodDays).catch(() => ({
      currentTotal: 0,
      priorTotal: 0,
      dailyCounts: [] as number[],
    })),
    // The hammer total's trend; null when it cannot be loaded, so the cell shows no chart.
    getAdminLotsHammerKpiTrend(periodDays).catch(() => null),
    getAdminLotsLiveKpiTrend(periodDays).catch(() => null),
  ]);

  const pageRows = lotResult.rows;
  const lensOwnedSort = activeLens === "ending" && !sp.sort;
  const lensesItems = applyLotsLensBadges(lenses, lotsSummary.lensCounts).map((lens) =>
    lens.id === "withdrawals" && withdrawalResult.tasks.length > 0
      ? { ...lens, badge: withdrawalResult.tasks.length }
      : lens,
  );

  const [artistRef, saleRef, categoryRef, filterOptionsResult] = await Promise.all([
    artistId.trim() ? getAdminArtistById(artistId).catch(() => null) : null,
    saleId.trim() ? getAdminSaleById(saleId).catch(() => null) : null,
    categoryId.trim() ? getAdminCategoryById(categoryId).catch(() => null) : null,
    Promise.allSettled([
      getAdminArtistList({ includeArchived: false, limit: 200 }),
      getAdminSalesList({ limit: 200 }),
      getServerCategoryReader().then((r) => r.tree()),
    ]),
  ]);

  const lotFilterOptions = {
    artists: filterOptionsResult[0].status === "fulfilled" ? filterOptionsResult[0].value.rows : [],
    sales:
      filterOptionsResult[1].status === "fulfilled"
        ? filterOptionsResult[1].value.map((r) => r.sale)
        : [],
    categories: filterOptionsResult[2].status === "fulfilled" ? filterOptionsResult[2].value : [],
  };

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

  const saleContextById = new Map<string, AdminLotSaleContext>(
    lotFilterOptions.sales.map((sale) => [
      sale.id,
      { title: sale.title, status: sale.status, deliveryMode: sale.deliveryMode },
    ]),
  );
  const missingSaleIds = [
    ...new Set(
      pageRows
        .map((row) => row.saleId)
        .filter((id): id is string => typeof id === "string" && id.trim() !== ""),
    ),
  ].filter((id) => !saleContextById.has(id));
  if (missingSaleIds.length > 0) {
    const resolved = await Promise.all(
      missingSaleIds.map(async (id) => {
        const ref = await getAdminSaleById(id).catch(() => null);
        if (!ref?.sale) return null;
        return [
          id,
          {
            title: ref.sale.title,
            status: ref.sale.status,
            deliveryMode: ref.sale.deliveryMode,
          },
        ] as const;
      }),
    );
    for (const entry of resolved) {
      if (entry) saleContextById.set(entry[0], entry[1]);
    }
  }

  const artistNameById = new Map(
    lotFilterOptions.artists.map((artist) => [artist.id, artist.displayName]),
  );
  const missingArtistIds = [
    ...new Set(
      pageRows
        .map((row) => row.artistId)
        .filter((id): id is string => typeof id === "string" && id.trim() !== ""),
    ),
  ].filter((id) => !artistNameById.has(id));
  if (missingArtistIds.length > 0) {
    const resolved = await Promise.all(
      missingArtistIds.map(async (id) => {
        const ref = await getAdminArtistById(id).catch(() => null);
        return ref?.displayName ? ([id, ref.displayName] as const) : null;
      }),
    );
    for (const entry of resolved) {
      if (entry) artistNameById.set(entry[0], entry[1]);
    }
  }

  const lotTableRows = toAdminLotTableRows(pageRows, { saleContextById, artistNameById });
  const hasFiltersBeyondLens =
    q.trim() !== "" ||
    artistId.trim() !== "" ||
    saleId.trim() !== "" ||
    categoryId.trim() !== "" ||
    Boolean(effectiveStatus && activeLens === "all") ||
    Boolean(effectiveSort && !lensOwnedSort);
  const listPaginationTotal = resolveLotsListPaginationTotal({
    activeLens,
    lensCounts: lotsSummary.lensCounts,
    hasFiltersBeyondLens,
  });
  const hasAttentionContent =
    model.attentionLens &&
    !withdrawalResult.err &&
    (withdrawalResult.tasks.length > 0 || lotTableRows.length > 0);

  return {
    periodDays,
    model,
    lotsSummary,
    lotsTrend: lotsTrendResult,
    lotsEndedTrend: lotsEndedTrendResult,
    hammerTrend: hammerTrendResult,
    liveTrend: liveTrendResult,
    navCounts: navCountsResult,
    listError: lotResult.err,
    pageRows,
    lotTableRows,
    hasNextPage: lotResult.hasNextPage ?? false,
    listPaginationTotal,
    withdrawalTasks: withdrawalResult.tasks,
    withdrawalLoadError: withdrawalResult.err,
    lensesItems,
    activeFilterChips,
    lotFilterOptions,
    connectRequiredByLotId: pageRows.length > 0 ? connectRequiredFromLots(pageRows) : undefined,
    hasAttentionContent: Boolean(hasAttentionContent),
    hasFiltersBeyondLens,
    withdrawalRequestedAt: Object.fromEntries(
      withdrawalResult.tasks
        .filter((task) => task.targetLotId)
        .map((task) => [task.targetLotId as string, new Date(task.createdAt).toISOString()]),
    ),
  };
}
