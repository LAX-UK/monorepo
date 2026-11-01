import { describe, expect, it } from "vitest";
import { resolveCalendarEmptyState } from "./sales-calendar-empty-state";

describe("resolveCalendarEmptyState", () => {
  it("offers clear filters only when a filter is set", () => {
    const filtered = resolveCalendarEmptyState({ tab: "upcoming", hasActiveFilters: true });
    expect(filtered.title).toBe("No sales match these filters");
    expect(filtered.action).toBe("clearFilters");

    const plain = resolveCalendarEmptyState({ tab: "upcoming", hasActiveFilters: false });
    expect(plain.action).not.toBe("clearFilters");
  });

  it("says nothing is scheduled on an unfiltered upcoming tab, with a link to results", () => {
    expect(resolveCalendarEmptyState({ tab: "upcoming", hasActiveFilters: false })).toEqual({
      title: "No sales are scheduled yet",
      description: "New sales are announced here first.",
      action: { label: "See recent results", href: "/results" },
    });
  });

  it("never claims a filter on an empty results tab", () => {
    const vm = resolveCalendarEmptyState({ tab: "results", hasActiveFilters: false });
    expect(vm.title).toBe("No results yet");
    expect(vm.action).toBeNull();
  });
});
