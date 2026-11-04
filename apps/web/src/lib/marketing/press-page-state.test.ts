import { describe, expect, it } from "vitest";
import { resolvePressPageState } from "./press-page-state";

const state = (matchingCount: number, archiveTotal: number, hasActiveFilters = false) =>
  resolvePressPageState({ matchingCount, archiveTotal, hasActiveFilters });

describe("resolvePressPageState", () => {
  it("shows a calm empty state with no toolbar or count when there is no coverage", () => {
    expect(state(0, 0)).toEqual({ view: "empty", showToolbar: false, showHeroStats: false });
  });

  it("lists one to six articles without a toolbar", () => {
    expect(state(1, 1)).toMatchObject({ view: "list", showToolbar: false, showHeroStats: true });
    expect(state(6, 6)).toMatchObject({ view: "list", showToolbar: false });
  });

  it("adds the toolbar once there are more than six articles", () => {
    expect(state(7, 7)).toMatchObject({ view: "list", showToolbar: true });
  });

  it("keeps the toolbar when filters leave nothing, so they can be changed", () => {
    expect(state(0, 3, true)).toMatchObject({ view: "filteredEmpty", showToolbar: true });
  });

  it("keeps the toolbar for filters on a short archive", () => {
    expect(state(2, 5, true)).toMatchObject({ view: "list", showToolbar: true });
  });
});
