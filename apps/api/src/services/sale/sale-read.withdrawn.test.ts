import type { Lot, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { getSaleDetailForPublicApi, listSaleLotsPageForPublicApi } from "./sale-read.js";
import type { SaleServiceDeps } from "./sale-types.js";

const sale = (overrides: Partial<Sale> = {}) =>
  ({
    id: "s1",
    title: "Autumn sale",
    status: "ended",
    coverImages: [],
    buyerPremiumTiers: null,
    ...overrides,
  }) as Sale;

const lot = (id: string, number: number, status: Lot["status"]) =>
  ({
    id,
    saleId: "s1",
    lotNumber: number,
    title: `Lot ${number}`,
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "c1",
    auctionType: "english",
    status,
    startingPrice: "100.00",
    currentPrice: "900.00",
    reservePrice: "500.00",
    winnerId: "buyer-1",
    marketingDetails: { estimate: { low: "1000", high: "2000", currency: "GBP" } },
  }) as unknown as Lot;

const lots = [
  lot("a", 1, "ended"),
  lot("b", 2, "cancelled"),
  lot("c", 3, "voided"),
  lot("d", 4, "draft"),
];

function deps(parent: Sale, rows: Lot[]): SaleServiceDeps {
  return {
    saleRepo: { findById: vi.fn().mockResolvedValue(parent) },
    lotRepo: {
      findBySaleId: vi.fn().mockResolvedValue(rows),
      listCatalogLotsBySalePage: vi.fn().mockResolvedValue({ items: rows, total: rows.length }),
    },
    saleFollowReader: null,
    mediaUrlResolver: undefined,
    catalogueMediaUrlResolver: undefined,
    mediaAssetEnricher: undefined,
    saleChannelReader: null,
  } as unknown as SaleServiceDeps;
}

describe("public sale detail with withdrawn lots", () => {
  it("lists a withdrawn lot as a slim row, and hides voided and draft lots", async () => {
    const detail = await getSaleDetailForPublicApi(deps(sale(), lots), "s1", undefined);
    const rows = detail?.data.lots ?? [];
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      ["a", "ended"],
      ["b", "withdrawn"],
    ]);
    const withdrawn = JSON.stringify(rows[1]);
    for (const secret of ["900.00", "500.00", "buyer-1", "1000"]) {
      expect(withdrawn).not.toContain(secret);
    }
  });

  it("gives staff the full rows, as before", async () => {
    const detail = await getSaleDetailForPublicApi(deps(sale(), lots), "s1", undefined, {
      role: "staff",
      staffRoles: ["cataloguer"],
    });
    expect(detail?.data.lots.map((r) => r.status)).toEqual([
      "ended",
      "cancelled",
      "voided",
      "draft",
    ]);
  });

  it("does not expose withdrawn lots of a sale that is not public", async () => {
    const detail = await getSaleDetailForPublicApi(
      deps(sale({ status: "draft" }), lots),
      "s1",
      undefined,
    );
    expect(detail).toBeNull();
  });
});

describe("public sale catalogue page with withdrawn lots", () => {
  it("returns the withdrawn lot as a slim row and asks the store for public catalogue rows", async () => {
    const d = deps(sale(), [lots[0] as Lot, lots[1] as Lot]);
    const page = await listSaleLotsPageForPublicApi(d, "s1", { limit: 40, offset: 0 });
    expect(page?.data.items.map((r) => [r.id, r.status])).toEqual([
      ["a", "ended"],
      ["b", "withdrawn"],
    ]);
    expect(d.lotRepo.listCatalogLotsBySalePage).toHaveBeenCalledWith(
      expect.objectContaining({ requirePublicSale: true }),
    );
  });
});
