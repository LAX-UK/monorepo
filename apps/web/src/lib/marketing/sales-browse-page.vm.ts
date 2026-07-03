import {
  mapSaleToAgendaItemVM,
  mapSaleToAuctionRowVM,
  mapSaleToCalendarGridCardVM,
  mapSaleToFeaturedAuctionCardVM,
} from "@/components/sections/sales/sales-view-models";
import type { SalesBrowseView } from "@/components/sections/sales/sales-view-switcher";
import type { SessionUser } from "@/lib/data/contracts";
import type { SaleListRow } from "@/lib/data/http/sales.server";
import { toCatalogLotVMs } from "@/lib/lot/to-catalog-lot-vm";
import { catalogViewCarryParams } from "@/lib/marketing/catalog-links";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { countActiveCalendarFilters } from "@/lib/marketing/sales-calendar-params";
import type { Category } from "@auction/types";
import type { Lot } from "@auction/types";

function collectYears(rows: SaleListRow[]): number[] {
  const ys = new Set<number>();
  for (const { sale } of rows) {
    ys.add(new Date(sale.startTime).getFullYear());
  }
  const list = [...ys].sort((a, b) => b - a);
  if (list.length === 0) list.push(new Date().getFullYear());
  return list;
}

export type SalesBrowsePageVM = {
  session: SessionUser | null;
  calendarState: CalendarSalesUrlState;
  hasLiveSales: boolean;
  categories: Category[];
  calendarView: SalesBrowseView;
  err: string | null;
  tab: CalendarSalesUrlState["tab"];
  newLots: Lot[];
  newLotsHasMore: boolean;
  newLotsCatalogLinkParams: ReturnType<typeof catalogViewCarryParams>;
  newLotVMs: ReturnType<typeof toCatalogLotVMs>;
  featuredVms: ReturnType<typeof mapSaleToFeaturedAuctionCardVM>[];
  yearOptions: number[];
  showSalesBrowse: boolean;
  rowVms: ReturnType<typeof mapSaleToAuctionRowVM>[];
  gridVms: ReturnType<typeof mapSaleToCalendarGridCardVM>[];
  agendaVms: ReturnType<typeof mapSaleToAgendaItemVM>[];
  hasActiveCalendarFilters: boolean;
  filteredSalesCount: number;
  calendarPage: number;
  calendarHasMore: boolean;
};

export type BuildSalesBrowsePageVMInput = {
  session: SessionUser | null;
  calendarState: CalendarSalesUrlState;
  hasLiveSales: boolean;
  categories: Category[];
  calendarView: SalesBrowseView;
  err: string | null;
  tab: CalendarSalesUrlState["tab"];
  newLots: Lot[];
  newLotsHasMore: boolean;
  saleRows: SaleListRow[];
  featuredRows: SaleListRow[];
  filteredSales: SaleListRow[];
  calendarPage: number;
  calendarHasMore: boolean;
};

export function buildSalesBrowsePageVM(input: BuildSalesBrowsePageVMInput): SalesBrowsePageVM {
  const featuredVms = input.featuredRows.map((row) => mapSaleToFeaturedAuctionCardVM(row));
  const yearOptions = collectYears(input.saleRows.length > 0 ? input.saleRows : input.featuredRows);
  const showSalesBrowse =
    input.tab === "upcoming" || input.tab === "live" || input.tab === "results";
  const rowVms = input.filteredSales.map((row) =>
    mapSaleToAuctionRowVM(row, {
      showRegisterButton:
        !input.session && (row.sale.status === "scheduled" || row.sale.status === "active"),
    }),
  );
  const gridVms = input.filteredSales.map((row) =>
    mapSaleToCalendarGridCardVM(row, {
      showRegisterButton:
        !input.session && (row.sale.status === "scheduled" || row.sale.status === "active"),
    }),
  );
  const agendaVms = input.filteredSales.map((row) => mapSaleToAgendaItemVM(row));
  const hasActiveCalendarFilters = countActiveCalendarFilters(input.calendarState) > 0;

  return {
    session: input.session,
    calendarState: input.calendarState,
    hasLiveSales: input.hasLiveSales,
    categories: input.categories,
    calendarView: input.calendarView,
    err: input.err,
    tab: input.tab,
    newLots: input.newLots,
    newLotsHasMore: input.newLotsHasMore,
    newLotsCatalogLinkParams: catalogViewCarryParams(input.calendarView),
    newLotVMs: toCatalogLotVMs(input.newLots),
    featuredVms,
    yearOptions,
    showSalesBrowse,
    rowVms,
    gridVms,
    agendaVms,
    hasActiveCalendarFilters,
    filteredSalesCount: input.filteredSales.length,
    calendarPage: input.calendarPage,
    calendarHasMore: input.calendarHasMore,
  };
}
