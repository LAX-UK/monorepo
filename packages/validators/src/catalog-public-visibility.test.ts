import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_BROWSE_LOT_STATUSES,
  PUBLIC_CATALOGUE_LOT_STATUSES,
  PUBLIC_LOT_STATUSES,
  filterLotsForPublicCatalog,
  isPublicCatalogLot,
  isPublicCatalogSale,
  isPublicCatalogueLot,
  isWithdrawnLot,
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

  it("rejects draft lots on non-ATG sales", () => {
    expect(isPublicCatalogLot(lot("draft"), sale("active"))).toBe(false);
  });

  it("accepts draft lots on publicly listed ATG-owned sales", () => {
    expect(
      isPublicCatalogLot(lot("draft"), {
        status: "draft",
        sellingPlatform: "atg",
        atgDistribution: "public_marketplace",
      } as Sale),
    ).toBe(true);
  });

  it("rejects draft lots on private-test ATG sales", () => {
    expect(
      isPublicCatalogLot(lot("draft"), {
        status: "draft",
        sellingPlatform: "atg",
        atgDistribution: "private_test",
      } as Sale),
    ).toBe(false);
  });

  it("keeps cancelled lots private even on ATG-owned sales", () => {
    expect(
      isPublicCatalogLot(lot("cancelled"), { status: "draft", sellingPlatform: "atg" } as Sale),
    ).toBe(false);
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
  it("rejects plain draft sales", () => {
    expect(isPublicCatalogSale({ status: "draft" } as Sale)).toBe(false);
  });

  it("accepts ATG-owned draft sales listed on the public marketplace", () => {
    expect(
      isPublicCatalogSale({
        status: "draft",
        sellingPlatform: "atg",
        atgDistribution: "public_marketplace",
      } as Sale),
    ).toBe(true);
  });

  it("rejects ATG-owned draft sales in a private test", () => {
    expect(
      isPublicCatalogSale({
        status: "draft",
        sellingPlatform: "atg",
        atgDistribution: "private_test",
      } as Sale),
    ).toBe(false);
    expect(isPublicCatalogSale({ status: "draft", sellingPlatform: "atg" } as Sale)).toBe(false);
  });

  it("rejects cancelled sales", () => {
    expect(isPublicCatalogSale({ status: "cancelled" } as Sale)).toBe(false);
  });

  it("rejects draft sales that are free or owned by LAX", () => {
    expect(isPublicCatalogSale({ status: "draft", sellingPlatform: "free" } as Sale)).toBe(false);
    expect(isPublicCatalogSale({ status: "draft", sellingPlatform: "lax" } as Sale)).toBe(false);
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
    expect(viewerCanSeeNonPublicCatalog("staff", ["cataloguer"])).toBe(true);
  });

  it("is false for anonymous clients", () => {
    expect(viewerCanSeeNonPublicCatalog(undefined)).toBe(false);
  });
});

describe("withdrawn lots", () => {
  const publicSale = { status: "ended" } as const;

  it("reads a withdrawn lot of a public sale on its page and in the catalogue", () => {
    expect(isPublicCatalogueLot({ status: "cancelled", saleId: "s1" }, publicSale)).toBe(true);
    expect(isWithdrawnLot({ status: "cancelled" })).toBe(true);
    expect(isWithdrawnLot({ status: "voided" })).toBe(false);
  });

  it("keeps a withdrawn lot out of the browse-style check", () => {
    expect(isPublicCatalogLot({ status: "cancelled", saleId: "s1" }, publicSale)).toBe(false);
  });

  it("hides a withdrawn lot whose sale is not public or that has no sale", () => {
    expect(isPublicCatalogueLot({ status: "cancelled", saleId: "s1" }, { status: "draft" })).toBe(
      false,
    );
    expect(isPublicCatalogueLot({ status: "cancelled", saleId: "s1" }, null)).toBe(false);
    expect(isPublicCatalogueLot({ status: "cancelled", saleId: null }, null)).toBe(false);
  });

  it("keeps voided and draft lots hidden", () => {
    expect(isPublicCatalogueLot({ status: "voided", saleId: "s1" }, publicSale)).toBe(false);
    expect(isPublicCatalogueLot({ status: "draft", saleId: "s1" }, publicSale)).toBe(false);
  });

  it("leaves other statuses to the existing rule", () => {
    expect(isPublicCatalogueLot({ status: "active", saleId: "s1" }, publicSale)).toBe(true);
  });

  it("adds cancelled only to the catalogue statuses, never to browse or archive", () => {
    expect(PUBLIC_CATALOGUE_LOT_STATUSES).toContain("cancelled");
    expect(PUBLIC_LOT_STATUSES).not.toContain("cancelled");
    expect(PUBLIC_BROWSE_LOT_STATUSES).not.toContain("cancelled");
  });

  it("does not let an anonymous list filter ask for withdrawn lots", () => {
    expect(
      resolvePublicLotListFilter({ status: "cancelled", viewerCanSeeNonPublic: false }),
    ).toEqual({ statuses: [] });
  });
});
