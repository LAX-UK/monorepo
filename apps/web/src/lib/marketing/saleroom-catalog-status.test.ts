import { describe, expect, it } from "vitest";
import {
  buildSaleroomClearStatusHref,
  buildSaleroomStatusHref,
  countActiveSaleroomStatusFilters,
  parseSaleroomCatalogStatus,
  saleroomStatusLabel,
} from "./saleroom-catalog-status";

describe("parseSaleroomCatalogStatus", () => {
  it("accepts known status values", () => {
    expect(parseSaleroomCatalogStatus("live")).toBe("live");
    expect(parseSaleroomCatalogStatus("upcoming")).toBe("upcoming");
    expect(parseSaleroomCatalogStatus("ended")).toBe("ended");
  });

  it("defaults to all for missing or unknown values", () => {
    expect(parseSaleroomCatalogStatus(undefined)).toBe("all");
    expect(parseSaleroomCatalogStatus(null)).toBe("all");
    expect(parseSaleroomCatalogStatus("active")).toBe("all");
  });
});

describe("buildSaleroomStatusHref", () => {
  it("sets status and clears page while preserving other params", () => {
    const current = new URLSearchParams("view=list&page=2&status=live");
    expect(buildSaleroomStatusHref("/sales/foo", "upcoming", current)).toBe(
      "/sales/foo?view=list&status=upcoming",
    );
  });

  it("removes status when value is all", () => {
    const current = new URLSearchParams("view=grid&status=ended&page=3");
    expect(buildSaleroomStatusHref("/sales/foo", "all", current)).toBe("/sales/foo?view=grid");
  });
});

describe("buildSaleroomClearStatusHref", () => {
  it("clears status filter", () => {
    const current = new URLSearchParams("status=live&view=list");
    expect(buildSaleroomClearStatusHref("/sales/foo", current)).toBe("/sales/foo?view=list");
  });
});

describe("saleroomStatusLabel", () => {
  it("maps values to labels", () => {
    expect(saleroomStatusLabel("live")).toBe("Live");
    expect(saleroomStatusLabel("all")).toBe("All");
  });
});

describe("countActiveSaleroomStatusFilters", () => {
  it("returns 0 for all and 1 for specific statuses", () => {
    expect(countActiveSaleroomStatusFilters("all")).toBe(0);
    expect(countActiveSaleroomStatusFilters("live")).toBe(1);
    expect(countActiveSaleroomStatusFilters("ended")).toBe(1);
  });
});
