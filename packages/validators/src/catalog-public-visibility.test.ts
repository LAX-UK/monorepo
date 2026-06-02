import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  filterLotsForPublicCatalog,
  isPublicCatalogLot,
  isPublicCatalogSale,
  resolvePublicLotListFilter,
  resolvePublicSaleListFilter,
  viewerCanSeeNonPublicCatalog,
} from "./catalog-public-visibility.js";

describe("resolvePublicLotListFilter", () => {
  it("defaults anonymous browse to scheduled + active", () => {
    expect(resolvePublicLotListFilter({ viewerCanSeeNonPublic: false })).toEqual({
      statuses: ["scheduled", "active"],
    });
  });

  it("allows anonymous ended archive query", () => {
    expect(resolvePublicLotListFilter({ status: "ended", viewerCanSeeNonPublic: false })).toEqual({
      status: "ended",
    });
  });

  it("allows anonymous multi-status when non-public removed", () => {
    expect(
      resolvePublicLotListFilter({
        statuses: ["draft", "scheduled", "active"],
        viewerCanSeeNonPublic: false,
      }),
    ).toEqual({ statuses: ["scheduled", "active"] });
  });

  it("blocks anonymous draft query", () => {
    expect(resolvePublicLotListFilter({ status: "draft", viewerCanSeeNonPublic: false })).toEqual({
      statuses: [],
    });
  });

  it("allows staff draft query", () => {
    expect(resolvePublicLotListFilter({ status: "draft", viewerCanSeeNonPublic: true })).toEqual({
      status: "draft",
    });
  });

  it("does not restrict staff when status omitted", () => {
    expect(resolvePublicLotListFilter({ viewerCanSeeNonPublic: true })).toEqual({});
  });
});

describe("resolvePublicSaleListFilter", () => {
  it("defaults anonymous browse to scheduled + active sales", () => {
    expect(resolvePublicSaleListFilter({ viewerCanSeeNonPublic: false })).toEqual({
      statuses: ["scheduled", "active"],
    });
  });

  it("allows anonymous multi-status when non-public removed", () => {
    expect(
      resolvePublicSaleListFilter({
        statuses: ["draft", "scheduled", "active"],
        viewerCanSeeNonPublic: false,
      }),
    ).toEqual({ statuses: ["scheduled", "active"] });
  });

  it("blocks anonymous draft-only sale query", () => {
    expect(resolvePublicSaleListFilter({ status: "draft", viewerCanSeeNonPublic: false })).toEqual({
      statuses: [],
    });
  });
});

describe("isPublicCatalogLot", () => {
  const lot = (status: Lot["status"], saleId: string | null = "sale-1"): Lot =>
    ({
      id: "lot-1",
      status,
      saleId,
    }) as Lot;

  const sale = (status: Sale["status"]): Sale =>
    ({
      id: "sale-1",
      status,
    }) as Sale;

  it("rejects draft lots", () => {
    expect(isPublicCatalogLot(lot("draft"), sale("active"))).toBe(false);
  });

  it("rejects scheduled lot on draft sale", () => {
    expect(isPublicCatalogLot(lot("scheduled"), sale("draft"))).toBe(false);
  });

  it("rejects scheduled lot when parent sale is missing", () => {
    expect(isPublicCatalogLot(lot("scheduled"), null)).toBe(false);
  });

  it("accepts active lot on active sale", () => {
    expect(isPublicCatalogLot(lot("active"), sale("active"))).toBe(true);
  });

  it("accepts standalone scheduled lot", () => {
    expect(isPublicCatalogLot(lot("scheduled", null), null)).toBe(true);
  });
});

describe("isPublicCatalogSale", () => {
  it("rejects draft sales", () => {
    expect(isPublicCatalogSale({ status: "draft" } as Sale)).toBe(false);
  });

  it("accepts scheduled sales", () => {
    expect(isPublicCatalogSale({ status: "scheduled" } as Sale)).toBe(true);
  });
});

describe("filterLotsForPublicCatalog", () => {
  it("drops lots on draft parent sales", () => {
    const lots = [
      { id: "a", status: "scheduled", saleId: "s1" },
      { id: "b", status: "active", saleId: "s2" },
    ] as Lot[];
    const sales = new Map<string, Sale>([
      ["s1", { id: "s1", status: "draft" } as Sale],
      ["s2", { id: "s2", status: "active" } as Sale],
    ]);
    expect(filterLotsForPublicCatalog(lots, sales).map((l) => l.id)).toEqual(["b"]);
  });

  it("drops lots when parent sale is absent from the map", () => {
    const lots = [{ id: "a", status: "scheduled", saleId: "s-missing" }] as Lot[];
    expect(filterLotsForPublicCatalog(lots, new Map()).map((l) => l.id)).toEqual([]);
  });
});

describe("viewerCanSeeNonPublicCatalog", () => {
  it("is true for catalogue.write staff", () => {
    expect(viewerCanSeeNonPublicCatalog("staff", "catalogue_manager")).toBe(true);
  });

  it("is false for anonymous clients", () => {
    expect(viewerCanSeeNonPublicCatalog(undefined, null)).toBe(false);
  });
});
