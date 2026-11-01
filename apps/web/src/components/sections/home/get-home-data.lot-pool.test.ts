import {
  buildHomeCatalogLotPool,
  pickHomeMoreLots,
} from "@/components/sections/home/get-home-data.lot-pool";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";

const baseLot = (overrides: Partial<Lot> = {}): Lot => ({
  id: "lot-1",
  saleId: null,
  lotNumber: 1,
  title: "Test lot",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
  categoryId: "c",
  auctionType: "english",
  startingPrice: "100",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "200",
  buyerPremiumRate: "0.25",
  minBidIncrement: "10",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date("2026-01-01T12:00:00.000Z"),
  endTime: new Date("2026-01-02T12:00:00.000Z"),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {},
  ...overrides,
});

describe("buildHomeCatalogLotPool", () => {
  it("merges active then scheduled and dedupes by id", () => {
    const active = [baseLot({ id: "a" }), baseLot({ id: "b" })];
    const scheduled = [
      baseLot({ id: "b", status: "scheduled" }),
      baseLot({ id: "c", status: "scheduled" }),
    ];
    expect(buildHomeCatalogLotPool(active, scheduled).map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("excludes draft lots even when callers pass them", () => {
    const active = [baseLot({ id: "draft-1", status: "draft" })];
    const scheduled = [
      baseLot({ id: "sched-1", status: "scheduled" }),
      baseLot({ id: "draft-2", status: "draft" }),
    ];
    expect(buildHomeCatalogLotPool(active, scheduled).map((l) => l.id)).toEqual(["sched-1"]);
  });
});

describe("pickHomeMoreLots", () => {
  const lots = (n: number, prefix = "lot") =>
    Array.from({ length: n }, (_, i) => baseLot({ id: `${prefix}-${i}` }));

  it("never repeats a lot already shown elsewhere on the page", () => {
    const pool = lots(8);
    const picked = pickHomeMoreLots({
      pool,
      shownLotIds: new Set(["lot-0", "lot-1", "lot-2"]),
      limit: 8,
    });
    expect(picked.map((l) => l.id)).toEqual(["lot-3", "lot-4", "lot-5", "lot-6", "lot-7"]);
  });

  it("is empty when fewer than four unique lots remain", () => {
    const picked = pickHomeMoreLots({
      pool: lots(6),
      shownLotIds: new Set(["lot-0", "lot-1", "lot-2"]),
      limit: 8,
    });
    expect(picked).toEqual([]);
  });

  it("shows exactly four unique lots", () => {
    expect(pickHomeMoreLots({ pool: lots(4), shownLotIds: new Set(), limit: 8 })).toHaveLength(4);
  });

  it("respects the limit", () => {
    expect(pickHomeMoreLots({ pool: lots(12), shownLotIds: new Set(), limit: 8 })).toHaveLength(8);
  });

  it("excludes draft lots from the pool", () => {
    const pool = buildHomeCatalogLotPool(
      [],
      [...lots(3), baseLot({ id: "draft-1", status: "draft" })],
    );
    expect(pickHomeMoreLots({ pool, shownLotIds: new Set(), limit: 8 })).toEqual([]);
  });
});
