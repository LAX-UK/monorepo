import { describe, expect, it } from "vitest";
import { type BuildSalesBrowsePageVMInput, buildSalesBrowsePageVM } from "./sales-browse-page.vm";

const input = (
  overrides: Partial<BuildSalesBrowsePageVMInput> = {},
): BuildSalesBrowsePageVMInput => ({
  session: null,
  calendarState: {
    tab: "upcoming",
    deliveryMode: "all",
    location: "all",
    sort: "startAsc",
    view: "grid",
  },
  hasLiveSales: false,
  categories: [],
  calendarView: "grid",
  loadFailed: false,
  tab: "upcoming",
  newLots: [],
  newLotsHasMore: false,
  saleRows: [],
  featuredRows: [],
  filteredSales: [],
  calendarPage: 1,
  calendarHasMore: false,
  ...overrides,
});

describe("buildSalesBrowsePageVM", () => {
  it("shows the browse area for a loaded, empty tab", () => {
    expect(buildSalesBrowsePageVM(input()).showSalesBrowse).toBe(true);
  });

  it("shows only the error state when the load failed", () => {
    const vm = buildSalesBrowsePageVM(input({ loadFailed: true }));
    expect(vm.loadFailed).toBe(true);
    expect(vm.showSalesBrowse).toBe(false);
  });
});
