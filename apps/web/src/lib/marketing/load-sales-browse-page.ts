import "server-only";

import type { SalesBrowseView } from "@/components/sections/sales/sales-view-switcher";
import { firstString } from "@/lib/admin/admin-list-params";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { type SaleListRow, getServerSalesList } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
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
): Promise<{ rows: SaleListRow[]; hasMore: boolean }> {
  const cat = categoryId ? { categoryId } : {};
  const sortParam = sort;
  const offset = (page - 1) * CALENDAR_PAGE_SIZE;
  const limit = CALENDAR_PAGE_SIZE + 1;
  try {
    let rows: SaleListRow[] = [];
    switch (tab) {
      case "upcoming":
        rows = await getServerSalesList({
          status: "scheduled",
          limit,
          offset,
          sort: sortParam,
          ...cat,
        });
        break;
      case "live":
        rows = await getServerSalesList({
          status: "active",
          limit,
          offset,
          sort: sortParam,
          ...cat,
        });
        break;
      case "results":
        rows = await getServerSalesList({
          status: "ended",
          limit,
          offset,
          sort: sortParam,
          ...cat,
        });
        break;
      default:
        return { rows: [], hasMore: false };
    }
    const hasMore = rows.length > CALENDAR_PAGE_SIZE;
    return { rows: rows.slice(0, CALENDAR_PAGE_SIZE), hasMore };
  } catch {
    return { rows: [], hasMore: false };
  }
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
  let err: string | null = null;

  try {
    if (tab === "newLots") {
      const reader = await getServerLotReader();
      const rows = await reader.list({
        limit: CALENDAR_PAGE_SIZE + 1,
        offset: (calendarPage - 1) * CALENDAR_PAGE_SIZE,
        sort: "createdDesc",
        status: "scheduled",
      });
      const page = deriveHasMorePage(rows, CALENDAR_PAGE_SIZE);
      newLots = page.items;
      newLotsHasMore = page.hasMore;
    } else if (tab === "privateSales") {
      saleRows = [];
    } else {
      const loaded = await loadSaleRowsForTab(tab, categoryId, sort, calendarPage);
      saleRows = loaded.rows;
      calendarHasMore = loaded.hasMore;
    }
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load data.";
  }

  let featuredRows: SaleListRow[] = [];
  try {
    featuredRows = await getServerSalesList({
      statuses: ["active", "scheduled"],
      limit: 3,
      sort: "startAsc",
    });
  } catch {
    featuredRows = [];
  }

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
    err,
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
    err,
    newLots,
    filteredSales,
  });

  return { vm, crumbText, listLdText };
}
