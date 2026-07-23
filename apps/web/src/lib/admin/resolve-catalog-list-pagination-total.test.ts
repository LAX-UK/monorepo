import { describe, expect, it } from "vitest";
import {
  resolveLotsListPaginationTotal,
  resolveSalesListPaginationTotal,
} from "./resolve-catalog-list-pagination-total";

describe("resolveLotsListPaginationTotal", () => {
  const lensCounts = { all: 120, live: 40, draft: 30, ending: 8, attention: 5 };

  it("returns lens count when only the lens is active", () => {
    expect(
      resolveLotsListPaginationTotal({
        activeLens: "live",
        lensCounts,
        hasFiltersBeyondLens: false,
      }),
    ).toBe(40);
  });

  it("returns undefined when extra filters are active", () => {
    expect(
      resolveLotsListPaginationTotal({
        activeLens: "all",
        lensCounts,
        hasFiltersBeyondLens: true,
      }),
    ).toBeUndefined();
  });
});

describe("resolveSalesListPaginationTotal", () => {
  const lensCounts = {
    all: 50,
    upcoming: 10,
    live: 8,
    closed: 20,
    settled: 12,
    setup: 3,
  };

  it("returns lens count when only the lens is active", () => {
    expect(
      resolveSalesListPaginationTotal({
        activeLensId: "setup",
        lensCounts,
        hasFiltersBeyondLens: false,
      }),
    ).toBe(3);
  });

  it("returns undefined when search or sheet filters are active", () => {
    expect(
      resolveSalesListPaginationTotal({
        activeLensId: "live",
        lensCounts,
        hasFiltersBeyondLens: true,
      }),
    ).toBeUndefined();
  });
});
