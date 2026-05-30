import { describe, expect, it } from "vitest";
import { salesListExportFilters } from "./sales-list-export-filters";

describe("salesListExportFilters", () => {
  it("maps closed lifecycle to ended + unsettled settlement", () => {
    expect(
      salesListExportFilters({
        limit: 50,
        offset: 0,
        lifecycle: "closed",
        status: "ended",
      }),
    ).toEqual({
      status: "ended",
      settlementStatus: "unsettled",
    });
  });

  it("maps settled lifecycle to ended + settled settlement", () => {
    expect(
      salesListExportFilters({
        limit: 50,
        offset: 0,
        lifecycle: "settled",
        status: "ended",
      }),
    ).toEqual({
      status: "ended",
      settlementStatus: "settled",
    });
  });

  it("passes upcoming and live status without settlement", () => {
    expect(
      salesListExportFilters(
        { limit: 50, offset: 0, lifecycle: "upcoming", status: "scheduled" },
        "startAsc",
      ),
    ).toEqual({ status: "scheduled", sort: "startAsc" });

    expect(
      salesListExportFilters({ limit: 50, offset: 0, lifecycle: "live", status: "active" }),
    ).toEqual({ status: "active" });
  });

  it("includes delivery and search", () => {
    expect(
      salesListExportFilters({
        limit: 50,
        offset: 0,
        delivery: "online",
        q: "spring",
      }),
    ).toEqual({ q: "spring", deliveryMode: "online" });
  });
});
