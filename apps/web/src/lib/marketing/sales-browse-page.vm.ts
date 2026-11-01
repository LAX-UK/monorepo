import {
  mapSaleToAgendaItemVM,
  mapSaleToAuctionRowVM,
  mapSaleToCalendarGridCardVM,
  mapSaleToFeaturedAuctionCardVM,
} from "@/components/sections/sales/sales-view-models";
import type { SalesBrowseView } from "@/components/sections/sales/sales-view-switcher";
import type { SessionUser } from "@/lib/data/contracts";
import type { SaleListRow } from "@/lib/data/http/sales.server";
import type { CalendarOverview } from "@/lib/marketing/sales-calendar-overview";
import { calendarTabCounts } from "@/lib/marketing/sales-calendar-overview";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { countActiveCalendarFilters } from "@/lib/marketing/sales-calendar-params";
import { type CalendarTab, resolveCalendarTabs } from "@/lib/marketing/sales-calendar-tabs";
import {
  type WhileYouWaitLink,
  buildWhileYouWait,
} from "@/lib/marketing/sales-calendar-while-you-wait";
import type { Category } from "@auction/types";

function collectYears(rows: SaleListRow[]): number[] {
  const ys = new Set<number>();
  for (const { sale } of rows) {
    ys.add(new Date(sale.startTime).getFullYear());
  }
  const list = [...ys].sort((a, b) => b - a);
  if (list.length === 0) list.push(new Date().getFullYear());
  return list;
}

/**
 * What the list area shows: the failure, an empty calendar (the page is the empty state), a
 * filter that matched nothing (the filters stay, with the way out) or the sales themselves.
 */
export type CalendarListState = "error" | "empty" | "filteredEmpty" | "results";

/**
 * The pinned sales sit above the list only on the default view: the Live tab, with no filter, on
 * its first page. Upcoming and Results open straight onto their own list.
 */
export function showsFeaturedSales(state: CalendarSalesUrlState): boolean {
  return state.tab === "live" && countActiveCalendarFilters(state) === 0 && (state.page ?? 1) <= 1;
}

export type SalesBrowsePageVM = {
  session: SessionUser | null;
  calendarState: CalendarSalesUrlState;
  tabs: CalendarTab[];
  categories: Category[];
  calendarView: SalesBrowseView;
  /** The tab's data could not be loaded (as opposed to loading and being empty). */
  loadFailed: boolean;
  tab: CalendarSalesUrlState["tab"];
  listState: CalendarListState;
  featuredVms: ReturnType<typeof mapSaleToFeaturedAuctionCardVM>[];
  yearOptions: number[];
  /** Counts, filters, rail and view switcher: only around a list, or a filtered miss. */
  showBrowseControls: boolean;
  rowVms: ReturnType<typeof mapSaleToAuctionRowVM>[];
  gridVms: ReturnType<typeof mapSaleToCalendarGridCardVM>[];
  agendaVms: ReturnType<typeof mapSaleToAgendaItemVM>[];
  hasActiveCalendarFilters: boolean;
  filteredSalesCount: number;
  /** The last result and open consignments, for the empty calendar. */
  whileYouWait: WhileYouWaitLink[];
  calendarPage: number;
  calendarHasMore: boolean;
};

export type BuildSalesBrowsePageVMInput = {
  session: SessionUser | null;
  calendarState: CalendarSalesUrlState;
  /** What each section holds, for the tab counts and the empty calendar. */
  overview: CalendarOverview;
  categories: Category[];
  calendarView: SalesBrowseView;
  /** The tab's data could not be loaded (as opposed to loading and being empty). */
  loadFailed: boolean;
  saleRows: SaleListRow[];
  featuredRows: SaleListRow[];
  filteredSales: SaleListRow[];
  calendarPage: number;
  calendarHasMore: boolean;
  now: Date;
};

function resolveListState(input: {
  loadFailed: boolean;
  salesCount: number;
  hasActiveFilters: boolean;
}): CalendarListState {
  if (input.loadFailed) return "error";
  if (input.salesCount > 0) return "results";
  return input.hasActiveFilters ? "filteredEmpty" : "empty";
}

export function buildSalesBrowsePageVM(input: BuildSalesBrowsePageVMInput): SalesBrowsePageVM {
  const tab = input.calendarState.tab;
  const hasActiveCalendarFilters = countActiveCalendarFilters(input.calendarState) > 0;
  const listState = resolveListState({
    loadFailed: input.loadFailed,
    salesCount: input.filteredSales.length,
    hasActiveFilters: hasActiveCalendarFilters,
  });
  const showFeatured = listState === "results" && showsFeaturedSales(input.calendarState);
  const featuredVms = showFeatured
    ? input.featuredRows.map((row) => mapSaleToFeaturedAuctionCardVM(row))
    : [];
  const yearOptions = collectYears(input.saleRows.length > 0 ? input.saleRows : input.featuredRows);
  const showRegisterButton = (row: SaleListRow) =>
    !input.session && (row.sale.status === "scheduled" || row.sale.status === "active");

  return {
    session: input.session,
    calendarState: input.calendarState,
    tabs: resolveCalendarTabs(calendarTabCounts(input.overview), tab),
    categories: input.categories,
    calendarView: input.calendarView,
    loadFailed: input.loadFailed,
    tab,
    listState,
    featuredVms,
    yearOptions,
    showBrowseControls: listState === "results" || listState === "filteredEmpty",
    rowVms: input.filteredSales.map((row) =>
      mapSaleToAuctionRowVM(row, { showRegisterButton: showRegisterButton(row) }),
    ),
    gridVms: input.filteredSales.map((row) =>
      mapSaleToCalendarGridCardVM(row, { showRegisterButton: showRegisterButton(row) }),
    ),
    agendaVms: input.filteredSales.map((row) => mapSaleToAgendaItemVM(row)),
    hasActiveCalendarFilters,
    filteredSalesCount: input.filteredSales.length,
    whileYouWait: listState === "empty" ? buildWhileYouWait(input.overview, input.now) : [],
    calendarPage: input.calendarPage,
    calendarHasMore: input.calendarHasMore,
  };
}
