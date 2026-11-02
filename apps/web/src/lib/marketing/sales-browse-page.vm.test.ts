import { describe, expect, it } from "vitest";
import { type BuildSalesBrowsePageVMInput, buildSalesBrowsePageVM } from "./sales-browse-page.vm";
import type { CalendarSalesUrlState } from "./sales-calendar-params";
import { calendarSaleRow } from "./sales-calendar.fixtures";

const NOW = new Date("2026-11-01T12:00:00.000Z");

const state = (overrides: Partial<CalendarSalesUrlState> = {}): CalendarSalesUrlState => ({
  tab: "upcoming",
  deliveryMode: "all",
  location: "all",
  sort: "startAsc",
  view: "grid",
  ...overrides,
});

const input = (
  overrides: Partial<BuildSalesBrowsePageVMInput> = {},
): BuildSalesBrowsePageVMInput => ({
  session: null,
  calendarState: state(),
  overview: {},
  categories: [],
  calendarView: "grid",
  loadFailed: false,
  saleRows: [],
  featuredRows: [],
  filteredSales: [],
  calendarPage: 1,
  calendarHasMore: false,
  now: NOW,
  ...overrides,
});

const live = calendarSaleRow("l1", "active");
const upcoming = calendarSaleRow("u1", "scheduled");
const ended = calendarSaleRow("r1", "ended");

describe("buildSalesBrowsePageVM: list state", () => {
  it("is results when the tab has sales, with the browse controls", () => {
    const vm = buildSalesBrowsePageVM(
      input({
        saleRows: [upcoming],
        filteredSales: [upcoming],
        overview: { upcoming: [upcoming] },
      }),
    );
    expect(vm.listState).toBe("results");
    expect(vm.showBrowseControls).toBe(true);
    expect(vm.rowVms).toHaveLength(1);
  });

  it("is empty for a quiet calendar: the page is the empty state, with no browse controls", () => {
    const vm = buildSalesBrowsePageVM(input());
    expect(vm.listState).toBe("empty");
    expect(vm.showBrowseControls).toBe(false);
    expect(vm.hasActiveCalendarFilters).toBe(false);
  });

  it("is filteredEmpty when a filter matched nothing, and keeps the controls", () => {
    const vm = buildSalesBrowsePageVM(
      input({ calendarState: state({ deliveryMode: "online" }), saleRows: [upcoming] }),
    );
    expect(vm.listState).toBe("filteredEmpty");
    expect(vm.showBrowseControls).toBe(true);
    expect(vm.whileYouWait).toEqual([]);
  });

  it("is error after a failed load, and hides the browse controls", () => {
    const vm = buildSalesBrowsePageVM(input({ loadFailed: true }));
    expect(vm.listState).toBe("error");
    expect(vm.loadFailed).toBe(true);
    expect(vm.showBrowseControls).toBe(false);
    expect(vm.whileYouWait).toEqual([]);
  });
});

describe("buildSalesBrowsePageVM: tabs", () => {
  it("hides Live and omits zero counts when only upcoming sales exist", () => {
    const vm = buildSalesBrowsePageVM(
      input({ overview: { live: [], upcoming: [upcoming], results: [] } }),
    );
    expect(vm.tabs.map((t) => t.id)).toEqual(["upcoming", "results"]);
    expect(vm.tabs.find((t) => t.id === "upcoming")?.count).toBe(1);
    expect(vm.tabs.find((t) => t.id === "results")).not.toHaveProperty("count");
  });

  it("leads with Live when a sale is live", () => {
    const vm = buildSalesBrowsePageVM(
      input({
        calendarState: state({ tab: "live" }),
        overview: { live: [live], upcoming: [upcoming], results: [ended] },
      }),
    );
    expect(vm.tabs.map((t) => t.id)).toEqual(["live", "upcoming", "results"]);
  });
});

describe("buildSalesBrowsePageVM: featured sales", () => {
  const featuredRows = [live, upcoming];

  it("shows them on the default view: the Live tab, unfiltered, first page", () => {
    const vm = buildSalesBrowsePageVM(
      input({
        calendarState: state({ tab: "live" }),
        saleRows: [live],
        filteredSales: [live],
        featuredRows,
      }),
    );
    expect(vm.featuredVms).toHaveLength(2);
  });

  it.each(["upcoming", "results"] as const)("never shows them above the %s tab", (tab) => {
    const vm = buildSalesBrowsePageVM(
      input({
        calendarState: state({ tab }),
        saleRows: [ended],
        filteredSales: [ended],
        featuredRows,
      }),
    );
    expect(vm.featuredVms).toEqual([]);
  });

  it("drops them once a filter is set or the list is on a later page", () => {
    const filtered = buildSalesBrowsePageVM(
      input({
        calendarState: state({ tab: "live", deliveryMode: "online" }),
        saleRows: [live],
        filteredSales: [live],
        featuredRows,
      }),
    );
    const paged = buildSalesBrowsePageVM(
      input({
        calendarState: state({ tab: "live", page: 2 }),
        saleRows: [live],
        filteredSales: [live],
        featuredRows,
      }),
    );
    expect(filtered.featuredVms).toEqual([]);
    expect(paged.featuredVms).toEqual([]);
  });

  it("drops them when the list is empty or failed", () => {
    const vm = buildSalesBrowsePageVM(
      input({ calendarState: state({ tab: "live" }), featuredRows, loadFailed: true }),
    );
    expect(vm.featuredVms).toEqual([]);
  });
});

describe("buildSalesBrowsePageVM: while you wait", () => {
  it("points an empty calendar at the last result and open consignments", () => {
    const withDeadline = calendarSaleRow("u2", "scheduled", {
      consignmentDeadline: "2027-01-15T12:00:00.000Z",
    });
    const vm = buildSalesBrowsePageVM(
      input({ overview: { upcoming: [withDeadline], results: [ended] } }),
    );
    expect(vm.whileYouWait.map((l) => l.id)).toEqual(["lastResult", "consignments"]);
  });

  it("is empty when there is nothing real to point at", () => {
    expect(buildSalesBrowsePageVM(input({ overview: { results: [] } })).whileYouWait).toEqual([]);
  });

  it("is not built around a list", () => {
    const vm = buildSalesBrowsePageVM(
      input({
        saleRows: [upcoming],
        filteredSales: [upcoming],
        overview: { upcoming: [upcoming], results: [ended] },
      }),
    );
    expect(vm.whileYouWait).toEqual([]);
  });
});
