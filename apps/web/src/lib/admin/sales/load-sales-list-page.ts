import "server-only";

import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { salesListController } from "@/lib/admin/admin-list-controllers";
import { applySalesLensBadges } from "@/lib/admin/apply-sales-lens-badges";
import {
  type SalesListSearchParams,
  buildSalesListPageModel,
} from "@/lib/admin/build-sales-list-page-model";
import { buildSalesActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { resolveSalesListPaginationTotal } from "@/lib/admin/resolve-catalog-list-pagination-total";
import {
  getAdminLotsHammerKpiTrend,
  getAdminSalesKpiTrend,
} from "@/lib/data/http/admin-kpi-trends.server";
import {
  EMPTY_ADMIN_SALES_LIST_SUMMARY,
  getAdminSalesListSummary,
} from "@/lib/data/http/admin-sales-summary.server";
import { toAdminSaleBoardRow } from "@/lib/data/view-models/admin-sales.vm";

type SaleListRow = Awaited<ReturnType<typeof salesListController.fetch>>["rows"][number];

/** Testable data/composition boundary for the sales list route. */
export async function loadAdminSalesListPage(sp: SalesListSearchParams) {
  const periodDays = parseAdminKpiPeriod(sp.period);
  const model = buildSalesListPageModel(sp);
  const {
    query,
    statusFilter,
    lifecycleSlug,
    deliveryFilter,
    activeLensId,
    lenses,
    activeFilterCount,
  } = model;

  const [salesSummary, salesTrend, salesHammerTrend, salesResult] = await Promise.all([
    getAdminSalesListSummary().catch(() => EMPTY_ADMIN_SALES_LIST_SUMMARY),
    getAdminSalesKpiTrend(periodDays).catch(() => ({
      currentTotal: 0,
      priorTotal: 0,
      dailyCounts: [] as number[],
    })),
    getAdminLotsHammerKpiTrend(periodDays).catch(() => ({
      currentTotal: 0,
      priorTotal: 0,
      dailyCounts: [] as number[],
    })),
    salesListController.fetch(query).then(
      (result) => ({ err: null as string | null, ...result }),
      (error) => ({
        err: error instanceof Error ? error.message : "Could not load sales.",
        rows: [] as SaleListRow[],
        hasNextPage: false,
      }),
    ),
  ]);

  const boardRows = salesResult.rows.map(toAdminSaleBoardRow);
  const hasFiltersBeyondLens =
    Boolean(query.q?.trim()) ||
    Boolean(statusFilter) ||
    Boolean(deliveryFilter) ||
    Boolean(lifecycleSlug && activeLensId === "all") ||
    Boolean(model.sort && activeLensId === "all");
  const listPaginationTotal = resolveSalesListPaginationTotal({
    activeLensId,
    lensCounts: salesSummary.lensCounts,
    hasFiltersBeyondLens,
  });
  const boardPagination =
    !salesResult.err && (query.offset > 0 || salesResult.hasNextPage)
      ? {
          offset: query.offset,
          limit: query.limit,
          countOnPage: salesResult.rows.length,
          ...(listPaginationTotal !== undefined ? { total: listPaginationTotal } : {}),
          prevHref:
            query.offset > 0
              ? model.buildPaginationHref({ offset: Math.max(0, query.offset - query.limit) })
              : null,
          nextHref: salesResult.hasNextPage
            ? model.buildPaginationHref({ offset: query.offset + query.limit })
            : null,
        }
      : null;

  return {
    periodDays,
    model,
    salesSummary,
    salesTrend,
    salesHammerTrend,
    err: salesResult.err,
    boardRows,
    lensesItems: applySalesLensBadges(lenses, salesSummary.lensCounts),
    activeFilterCount,
    activeFilterChips: buildSalesActiveFilterChips(sp, {
      ...(query.q ? { q: query.q } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(deliveryFilter ? { deliveryMode: deliveryFilter } : {}),
      ...(lifecycleSlug ? { lifecycle: lifecycleSlug } : {}),
      ...(model.sort ? { sort: model.sort } : {}),
      activeLensId,
      lensOwnedLifecycle: activeLensId !== "all" && activeLensId !== "setup" && !sp.lifecycle,
      setupLens: model.setupLens,
    }),
    boardPagination,
    listPaginationTotal,
  };
}
