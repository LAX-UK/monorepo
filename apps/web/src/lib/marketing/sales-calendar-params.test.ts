import { describe, expect, it } from "vitest";
import {
  buildCalendarActiveFilterChips,
  calendarClearFiltersHref,
  calendarDeliveryLabel,
  calendarLocationLabel,
  calendarMonthLabel,
  calendarPriceRangeLabel,
  calendarSalesHref,
  countActiveCalendarFilters,
  hasExplicitCalendarTab,
  parseCalendarPrimaryTab,
  resolveDefaultCalendarPrimaryTab,
  resolveRetiredCalendarTabHref,
} from "./sales-calendar-params";
import type { CalendarSalesUrlState } from "./sales-calendar-params";

const baseState: CalendarSalesUrlState = {
  tab: "upcoming",
  deliveryMode: "all",
  location: "all",
  sort: "startAsc",
  view: "grid",
};

describe("calendarClearFiltersHref", () => {
  it("preserves tab and view while dropping facets", () => {
    const state: CalendarSalesUrlState = {
      ...baseState,
      tab: "live",
      view: "list",
      categoryId: "cat-1",
      deliveryMode: "online",
      location: "london",
      month: 3,
      year: 2026,
      minPrice: 1000,
      page: 2,
    };
    expect(calendarClearFiltersHref(state)).toBe("/sales?tab=live&view=list");
  });
});

describe("calendarSalesHref", () => {
  it("always emits an explicit tab, including upcoming", () => {
    expect(calendarSalesHref({ tab: "upcoming" })).toBe("/sales?tab=upcoming");
    expect(calendarSalesHref({ tab: "results" })).toBe("/sales?tab=results");
  });

  it("defaults to the upcoming tab when none is provided", () => {
    expect(calendarSalesHref({})).toBe("/sales?tab=upcoming");
  });
});

describe("calendar facet labels", () => {
  it("maps delivery and location labels", () => {
    expect(calendarDeliveryLabel("online")).toBe("Online");
    expect(calendarDeliveryLabel("onsite")).toBe("In-person");
    expect(calendarDeliveryLabel("all")).toBeNull();
    expect(calendarLocationLabel("online")).toBe(calendarDeliveryLabel("online"));
    expect(calendarLocationLabel("london")).toBe("London");
    expect(calendarLocationLabel("all")).toBeNull();
  });

  it("maps month and price labels", () => {
    expect(calendarMonthLabel(3)).toBe("March");
    expect(calendarPriceRangeLabel({ ...baseState, minPrice: 5000, maxPrice: 25000 })).toMatch(
      /£5,000.*£25,000/,
    );
  });
});

describe("buildCalendarActiveFilterChips", () => {
  it("builds removable chips for active facets", () => {
    const state: CalendarSalesUrlState = {
      ...baseState,
      deliveryMode: "online",
      categoryId: "cat-1",
    };
    const chips = buildCalendarActiveFilterChips(state, [{ id: "cat-1", name: "Modern Art" }]);
    expect(chips).toHaveLength(2);
    expect(chips[0]?.label).toBe("Online");
    expect(chips[1]?.label).toBe("Modern Art");
    expect(chips[0]?.removeHref).not.toContain("delivery=");
  });

  it("returns empty array when no facets are active", () => {
    expect(buildCalendarActiveFilterChips(baseState, [])).toEqual([]);
  });
});

describe("countActiveCalendarFilters", () => {
  it("counts active facets", () => {
    expect(
      countActiveCalendarFilters({
        ...baseState,
        deliveryMode: "online",
        month: 5,
      }),
    ).toBe(2);
  });
});

describe("hasExplicitCalendarTab", () => {
  it("returns true for tab param", () => {
    expect(hasExplicitCalendarTab({ tab: "live" })).toBe(true);
  });

  it("returns true for known tabs regardless of casing", () => {
    expect(hasExplicitCalendarTab({ tab: "Results" })).toBe(true);
    expect(hasExplicitCalendarTab({ tab: "LIVE" })).toBe(true);
  });

  it("returns false when tab is omitted", () => {
    expect(hasExplicitCalendarTab({})).toBe(false);
    expect(hasExplicitCalendarTab({ categoryId: "cat-1" })).toBe(false);
  });
});

describe("parseCalendarPrimaryTab", () => {
  it("resolves known tabs to their canonical id", () => {
    expect(parseCalendarPrimaryTab({ tab: "results" })).toBe("results");
    expect(parseCalendarPrimaryTab({ tab: "live" })).toBe("live");
  });

  it("falls back to upcoming for a retired tab", () => {
    expect(parseCalendarPrimaryTab({ tab: "newLots" })).toBe("upcoming");
    expect(parseCalendarPrimaryTab({ tab: "privateSales" })).toBe("upcoming");
  });

  it("matches case-insensitively", () => {
    expect(parseCalendarPrimaryTab({ tab: "RESULTS" })).toBe("results");
  });

  it("defaults to upcoming when tab is omitted", () => {
    expect(parseCalendarPrimaryTab({})).toBe("upcoming");
  });
});

describe("resolveDefaultCalendarPrimaryTab", () => {
  it("prefers live when sales are active", () => {
    expect(resolveDefaultCalendarPrimaryTab(true)).toBe("live");
    expect(resolveDefaultCalendarPrimaryTab(false)).toBe("upcoming");
  });
});

describe("resolveRetiredCalendarTabHref", () => {
  it("sends new lots to the search sort, whatever the casing", () => {
    expect(resolveRetiredCalendarTabHref({ tab: "newLots" })).toBe("/search?sort=createdDesc");
    expect(resolveRetiredCalendarTabHref({ tab: "newlots" })).toBe("/search?sort=createdDesc");
  });

  it("sends private sales to the enquiry form", () => {
    expect(resolveRetiredCalendarTabHref({ tab: "privateSales" })).toBe(
      "/contact?intent=private-sale",
    );
  });

  it("leaves current tabs and a missing tab alone", () => {
    expect(resolveRetiredCalendarTabHref({ tab: "results" })).toBeNull();
    expect(resolveRetiredCalendarTabHref({})).toBeNull();
  });
});
