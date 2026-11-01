import "server-only";

import type { SalesBrowseView } from "@/components/sections/sales/sales-view-switcher";
import { firstString } from "@/lib/admin/admin-list-params";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { type SaleListRow, getServerSalesList } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { type LoadResult, settle } from "@/lib/marketing/load-result";
import { deriveHasMorePage } from "@/lib/marketing/pagination";
import { buildSalesBrowsePageJsonLd } from "@/lib/marketing/sales-browse-page.seo";
import { buildSalesBrowsePageVM } from "@/lib/marketing/sales-browse-page.vm";
import { applyCalendarRowFilters } from "@/lib/marketing/sales-calendar-filter-utils";
import { fetchHasLiveSales } from "@/lib/marketing/sales-calendar-live.server";
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
} from "@/lib/marketing/sales-calendar-params";
import { parseSalesCategoryId } from "@/lib/marketing/sales-filters";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
import type { Lot } from "@auction/types";
import { redirect } from "next/navigation";

const CALENDAR_PAGE_SIZE = 24;

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
    let rows: SaleListRow[] = [];
    // Results are the record of the market: the most recent sale comes first.
    if (tab === "upcoming") rows = await getServerSalesList(query("scheduled"));
    else if (tab === "live") rows = await getServerSalesList(query("active"));
    else if (tab === "results") rows = await getServerSalesList(query("ended"));
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

  const [categories, hasLiveSales] = await Promise.all([
    getServerCategoryReader()
      .then((r) => r.list())
      .catch(() => []),
    fetchHasLiveSales(),
  ]);
  const categoryId = parseSalesCategoryId(searchParams, categories);
  const deliveryMode = parseDeliveryMode(searchParams);
  const location = parseLocationFilter(searchParams);
  const sort = parseSort(searchParams);
  const month = parseMonth(searchParams);
  const year = parseYear(searchParams);
  const { minPrice, maxPrice } = parsePriceRange(searchParams);
  const calendarPage = parseCalendarPage(searchParams);

  if (
    !hasExplicitCalendarTab(searchParams) &&
    resolveDefaultCalendarPrimaryTab(hasLiveSales) === "live"
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

  let saleRows: SaleListRow[] = [];
  let calendarHasMore = false;
  let newLots: Lot[] = [];
  let newLotsHasMore = false;
  let loadFailedForTab = false;

  if (tab === "newLots") {
    const result = await settle("sales calendar new lots", async () => {
      const reader = await getServerLotReader();
      const rows = await reader.list({
        limit: CALENDAR_PAGE_SIZE + 1,
        offset: (calendarPage - 1) * CALENDAR_PAGE_SIZE,
        sort: "createdDesc",
        status: "scheduled",
      });
      return deriveHasMorePage(rows, CALENDAR_PAGE_SIZE);
    });
    if (result.ok) {
      newLots = result.value.items;
      newLotsHasMore = result.value.hasMore;
    } else {
      loadFailedForTab = true;
    }
  } else if (tab !== "privateSales") {
    const result = await loadSaleRowsForTab(tab, categoryId, sort, calendarPage);
    if (result.ok) {
      saleRows = result.value.rows;
      calendarHasMore = result.value.hasMore;
    } else {
      loadFailedForTab = true;
    }
  }

  const featured = await settle("sales calendar featured", () =>
    getServerSalesList({ statuses: ["active", "scheduled"], limit: 3, sort: "startAsc" }),
  );
  const featuredRows: SaleListRow[] = featured.ok ? featured.value : [];

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
    hasLiveSales,
    categories,
    calendarView,
    loadFailed: loadFailedForTab,
    tab,
    newLots,
    newLotsHasMore,
    saleRows,
    featuredRows,
    filteredSales,
    calendarPage,
    calendarHasMore,
  });

  const { crumbText, listLdText } = buildSalesBrowsePageJsonLd({
    tab,
    loadFailed: loadFailedForTab,
    newLots,
    filteredSales,
  });

  return { vm, crumbText, listLdText };
}
