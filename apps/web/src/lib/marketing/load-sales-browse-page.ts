import "server-only";

import type { SalesBrowseView } from "@/components/sections/sales/sales-view-switcher";
import { firstString } from "@/lib/admin/admin-list-params";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { type SaleListRow, getServerSalesList } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { type LoadResult, settle } from "@/lib/marketing/load-result";
import { buildSalesBrowsePageJsonLd } from "@/lib/marketing/sales-browse-page.seo";
import { buildSalesBrowsePageVM, showsFeaturedSales } from "@/lib/marketing/sales-browse-page.vm";
import { applyCalendarRowFilters } from "@/lib/marketing/sales-calendar-filter-utils";
import { calendarTabCounts } from "@/lib/marketing/sales-calendar-overview";
import { loadCalendarOverview } from "@/lib/marketing/sales-calendar-overview.server";
import {
  type CalendarPrimaryTab,
  type CalendarSalesUrlState,
  calendarSalesHref,
  hasExplicitCalendarTab,
  parseCalendarPage,
  parseCalendarPrimaryTab,
  parseDeliveryMode,
  parseLocationFilter,
  parseMonth,
  parsePriceRange,
  parseSort,
  parseYear,
  resolveDefaultCalendarPrimaryTab,
  resolveRetiredCalendarTabHref,
} from "@/lib/marketing/sales-calendar-params";
import { hasLiveSales } from "@/lib/marketing/sales-calendar-tabs";
import { parseSalesCategoryId } from "@/lib/marketing/sales-filters";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
import { redirect } from "next/navigation";

const CALENDAR_PAGE_SIZE = 24;

const TAB_STATUS = {
  upcoming: "scheduled",
  live: "active",
  results: "ended",
} as const satisfies Record<CalendarPrimaryTab, "scheduled" | "active" | "ended">;

async function loadSaleRowsForTab(
  tab: CalendarPrimaryTab,
  categoryId: string | undefined,
  sort: "startAsc" | "createdDesc",
  page: number,
): Promise<LoadResult<{ rows: SaleListRow[]; hasMore: boolean }>> {
  const cat = categoryId ? { categoryId } : {};
  const sortParam = sort;
  const offset = (page - 1) * CALENDAR_PAGE_SIZE;
  const limit = CALENDAR_PAGE_SIZE + 1;
  const query = (status: "scheduled" | "active" | "ended") => ({
    status,
    limit,
    offset,
    sort: status === "ended" ? ("endDesc" as const) : sortParam,
    ...cat,
  });
  return settle("sales calendar", async () => {
    // Results are the record of the market: the most recent sale comes first.
    const rows = await getServerSalesList(query(TAB_STATUS[tab]));
    const hasMore = rows.length > CALENDAR_PAGE_SIZE;
    return { rows: rows.slice(0, CALENDAR_PAGE_SIZE), hasMore };
  });
}

export type SalesBrowsePageData = {
  vm: ReturnType<typeof buildSalesBrowsePageVM>;
  crumbText: string;
  listLdText: string | null;
};

export async function loadSalesBrowsePage(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<SalesBrowsePageData> {
  if (firstString(searchParams.tab)?.toLowerCase() === "artists") {
    redirect("/artists");
  }
  const retiredTabHref = resolveRetiredCalendarTabHref(searchParams);
  if (retiredTabHref) redirect(retiredTabHref);
  const session = await getServerSessionUser();

  const rawView = firstString(searchParams.view);
  const isCalendarLayout = rawView === "calendar";
  const salesLayoutResolved = await resolveMarketingLayoutView({
    routeKey: "sales",
    category: "sales",
    urlView: isCalendarLayout ? undefined : rawView,
    user: session,
    fallback: "list",
  });
  const calendarView: SalesBrowseView = isCalendarLayout
    ? "calendar"
    : salesLayoutResolved === "list"
      ? "list"
      : "grid";

  const categories = await getServerCategoryReader()
    .then((r) => r.list())
    .catch(() => []);
  const categoryId = parseSalesCategoryId(searchParams, categories);
  const deliveryMode = parseDeliveryMode(searchParams);
  const location = parseLocationFilter(searchParams);
  const sort = parseSort(searchParams);
  const month = parseMonth(searchParams);
  const year = parseYear(searchParams);
  const { minPrice, maxPrice } = parsePriceRange(searchParams);
  const calendarPage = parseCalendarPage(searchParams);

  // What each section holds: the tabs' counts, the live landing and the empty calendar's neighbours.
  const overview = await loadCalendarOverview(categoryId);

  if (
    !hasExplicitCalendarTab(searchParams) &&
    resolveDefaultCalendarPrimaryTab(hasLiveSales(calendarTabCounts(overview))) === "live"
  ) {
    redirect(
      calendarSalesHref({
        tab: "live",
        ...(categoryId ? { categoryId } : {}),
        ...(deliveryMode !== "all" ? { deliveryMode } : {}),
        ...(location !== "all" ? { location } : {}),
        ...(sort !== "startAsc" ? { sort } : {}),
        ...(month != null ? { month } : {}),
        ...(year != null ? { year } : {}),
        ...(minPrice != null ? { minPrice } : {}),
        ...(maxPrice != null ? { maxPrice } : {}),
        ...(calendarView !== "grid" ? { view: calendarView } : {}),
        ...(calendarPage > 1 ? { page: calendarPage } : {}),
      }),
    );
  }

  const tab = parseCalendarPrimaryTab(searchParams);

  const calendarState: CalendarSalesUrlState = {
    tab,
    deliveryMode,
    location,
    sort,
    view: calendarView,
    ...(categoryId ? { categoryId } : {}),
    ...(month != null ? { month } : {}),
    ...(year != null ? { year } : {}),
    ...(minPrice != null ? { minPrice } : {}),
    ...(maxPrice != null ? { maxPrice } : {}),
    ...(calendarPage > 1 ? { page: calendarPage } : {}),
  };

  const tabResult = await loadSaleRowsForTab(tab, categoryId, sort, calendarPage);
  const saleRows = tabResult.ok ? tabResult.value.rows : [];
  const calendarHasMore = tabResult.ok ? tabResult.value.hasMore : false;

  // The pinned sales belong to the default view only, so no other tab pays for reading them.
  const featured = showsFeaturedSales(calendarState)
    ? await settle("sales calendar featured", () =>
        getServerSalesList({ statuses: ["active", "scheduled"], limit: 3, sort: "startAsc" }),
      )
    : null;
  const featuredRows: SaleListRow[] = featured?.ok ? featured.value : [];

  const filteredSales = applyCalendarRowFilters(saleRows, {
    ...(deliveryMode !== "all" ? { deliveryMode } : {}),
    ...(location !== "all" ? { location } : {}),
    ...(month != null ? { month } : {}),
    ...(year != null ? { year } : {}),
    ...(minPrice != null ? { minPrice } : {}),
    ...(maxPrice != null ? { maxPrice } : {}),
  });

  const vm = buildSalesBrowsePageVM({
    session,
    calendarState,
    overview,
    categories,
    calendarView,
    loadFailed: !tabResult.ok,
    saleRows,
    featuredRows,
    filteredSales,
    calendarPage,
    calendarHasMore,
    now: new Date(),
  });

  const { crumbText, listLdText } = buildSalesBrowsePageJsonLd({
    loadFailed: !tabResult.ok,
    filteredSales,
  });

  return { vm, crumbText, listLdText };
}
