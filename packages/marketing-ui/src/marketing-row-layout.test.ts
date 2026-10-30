import { describe, expect, it } from "vitest";
import {
  marketingFeatureGridLayout,
  marketingFeatureGridRole,
  marketingMixedRailSlots,
  marketingRailHasEnough,
  marketingRowCap,
  marketingRowColumns,
  marketingRowLayout,
} from "./marketing-row-layout.js";

describe("marketingMixedRailSlots", () => {
  it("repeats tall, wide, then a stacked pair", () => {
    expect(marketingMixedRailSlots(8)).toEqual([
      { kind: "tall", items: [0] },
      { kind: "wide", items: [1] },
      { kind: "pair", items: [2, 3] },
      { kind: "tall", items: [4] },
      { kind: "wide", items: [5] },
      { kind: "pair", items: [6, 7] },
    ]);
  });

  it("never leaves a pair half empty: a lone last item takes a tall slot", () => {
    expect(marketingMixedRailSlots(3).map((slot) => slot.kind)).toEqual(["tall", "wide", "tall"]);
    expect(marketingMixedRailSlots(7).at(-1)).toEqual({ kind: "tall", items: [6] });
  });

  it("returns nothing for no items", () => {
    expect(marketingMixedRailSlots(0)).toEqual([]);
    expect(marketingMixedRailSlots(-2)).toEqual([]);
  });
});

describe("marketingRowLayout", () => {
  it.each([
    [0, null],
    [1, "feature"],
    [2, "pair"],
    [3, "grid"],
    [9, "grid"],
  ] as const)("composes %i items as %s", (count, layout) => {
    expect(marketingRowLayout(count)).toBe(layout);
  });
});

describe("marketingRowCap", () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 4],
    [12, 4],
  ] as const)("shows %i items as %i in one row of four", (count, shown) => {
    expect(marketingRowCap(count)).toBe(shown);
  });

  it.each([
    [2, 3, 2],
    [5, 3, 3],
    [7, 8, 4],
    [8, 8, 8],
    [11, 8, 8],
  ] as const)(
    "with %i items and a max of %i shows %i, never a partial second row",
    (count, max, shown) => {
      expect(marketingRowCap(count, max)).toBe(shown);
    },
  );

  it("shows nothing for a negative count or max", () => {
    expect(marketingRowCap(-1)).toBe(0);
    expect(marketingRowCap(5, 0)).toBe(0);
  });
});

describe("marketingRowColumns", () => {
  it("lays three items as a row of three and more as rows of four", () => {
    expect(marketingRowColumns(3)).toBe(3);
    expect(marketingRowColumns(4)).toBe(4);
    expect(marketingRowColumns(8)).toBe(4);
  });
});

describe("marketingRailHasEnough", () => {
  it("needs three items for a rail", () => {
    expect(marketingRailHasEnough(2)).toBe(false);
    expect(marketingRailHasEnough(3)).toBe(true);
  });
});

describe("marketingFeatureGridLayout", () => {
  it.each([
    ["lead-plus-row", 1, "feature"],
    ["lead-plus-row", 2, "pair"],
    ["lead-plus-row", 3, "lead-plus-pair"],
    ["lead-plus-row", 4, "lead-plus-row"],
    ["lead-plus-stack", 1, "feature"],
    ["lead-plus-stack", 2, "pair"],
    ["lead-plus-stack", 3, "lead-plus-stack"],
  ] as const)("%s with %i items is %s", (variant, count, layout) => {
    expect(marketingFeatureGridLayout(variant, count)).toBe(layout);
  });

  it("hides an empty grid", () => {
    expect(marketingFeatureGridLayout("lead-plus-row", 0)).toBeNull();
  });
});

describe("marketingFeatureGridRole", () => {
  it("gives the first item the wide role unless it leads a stack or sits in a pair", () => {
    expect(marketingFeatureGridRole("feature", 0)).toBe("solo");
    expect(marketingFeatureGridRole("lead-plus-pair", 0)).toBe("feature");
    expect(marketingFeatureGridRole("lead-plus-row", 0)).toBe("feature");
    expect(marketingFeatureGridRole("lead-plus-stack", 0)).toBe("lead");
    expect(marketingFeatureGridRole("pair", 0)).toBe("item");
    expect(marketingFeatureGridRole("lead-plus-row", 2)).toBe("item");
  });
});
