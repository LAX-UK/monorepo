import { describe, expect, it } from "vitest";
import { resolveCalendarEmptyState } from "./sales-calendar-empty-state";

describe("resolveCalendarEmptyState", () => {
  it("offers clear filters only when a filter is set", () => {
    const filtered = resolveCalendarEmptyState({ tab: "upcoming", hasActiveFilters: true });
    expect(filtered.title).toBe("No sales match these filters");
    expect(filtered.kind).toBe("clearFilters");
    expect(filtered.offersRecentResults).toBe(false);

    const plain = resolveCalendarEmptyState({ tab: "upcoming", hasActiveFilters: false });
    expect(plain.kind).toBe("alerts");
  });

  it("says nothing is scheduled on an unfiltered upcoming tab, with a link to results", () => {
    const vm = resolveCalendarEmptyState({ tab: "upcoming", hasActiveFilters: false });
    expect(vm.title).toBe("No sales are scheduled yet");
    expect(vm.description).toMatch(/^New sales are announced here first\./);
    expect(vm.offersRecentResults).toBe(true);
  });

  it("never claims a filter on an empty results tab, and does not link to itself", () => {
    const vm = resolveCalendarEmptyState({ tab: "results", hasActiveFilters: false });
    expect(vm.title).toBe("No results yet");
    expect(vm.kind).toBe("alerts");
    expect(vm.offersRecentResults).toBe(false);
  });
});
