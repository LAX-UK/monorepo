import { describe, expect, it } from "vitest";
import {
  buildCalendarActiveFilterChips,
  calendarClearFiltersHref,
  calendarDeliveryLabel,
  calendarLocationLabel,
  calendarMonthLabel,
  calendarPriceRangeLabel,
  countActiveCalendarFilters,
  getCalendarPrimaryTabDefinitions,
  hasExplicitCalendarTab,
  resolveDefaultCalendarPrimaryTab,
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
    expect(calendarPriceRangeLabel({ ...baseState, minPrice: 5000, maxPrice: 25000 })).toBe(
      "£5,000–£25,000",
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

  it("returns true for legacy filter param", () => {
    expect(hasExplicitCalendarTab({ filter: "scheduled" })).toBe(true);
  });

  it("returns false when tab is omitted", () => {
    expect(hasExplicitCalendarTab({})).toBe(false);
    expect(hasExplicitCalendarTab({ categoryId: "cat-1" })).toBe(false);
  });
});

describe("resolveDefaultCalendarPrimaryTab", () => {
  it("prefers live when sales are active", () => {
    expect(resolveDefaultCalendarPrimaryTab(true)).toBe("live");
    expect(resolveDefaultCalendarPrimaryTab(false)).toBe("upcoming");
  });
});

describe("getCalendarPrimaryTabDefinitions", () => {
  it("keeps upcoming first when no live sales", () => {
    const tabs = getCalendarPrimaryTabDefinitions(false);
    expect(tabs[0]?.id).toBe("upcoming");
    expect(tabs[1]?.id).toBe("live");
  });

  it("puts live first when live sales exist", () => {
    const tabs = getCalendarPrimaryTabDefinitions(true);
    expect(tabs[0]?.id).toBe("live");
    expect(tabs[1]?.id).toBe("upcoming");
  });
});
