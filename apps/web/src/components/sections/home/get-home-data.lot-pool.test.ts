import {
  allocateHomePageLots,
  buildHomeCatalogLotPool,
  homePinnedSaleIds,
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

describe("allocateHomePageLots", () => {
  const lots = (n: number, prefix = "lot") =>
    Array.from({ length: n }, (_, i) => baseLot({ id: `${prefix}-${i}` }));
  const ids = (xs: Lot[]) => xs.map((l) => l.id);

  it("never repeats a rail lot in More lots", () => {
    const pool = lots(8);
    const { rail, more } = allocateHomePageLots({
      railLots: pool.slice(0, 3),
      pool,
      moreLimit: 8,
    });
    expect(ids(rail)).toEqual(["lot-0", "lot-1", "lot-2"]);
    expect(ids(more)).toEqual(["lot-3", "lot-4", "lot-5", "lot-6", "lot-7"]);
  });

  it("hides More lots when fewer than four unseen lots remain", () => {
    const pool = lots(6);
    expect(allocateHomePageLots({ railLots: pool.slice(0, 3), pool, moreLimit: 8 }).more).toEqual(
      [],
    );
  });

  it("shows exactly four unseen lots", () => {
    expect(allocateHomePageLots({ railLots: [], pool: lots(4), moreLimit: 8 }).more).toHaveLength(
      4,
    );
  });

  it("respects the limit", () => {
    expect(allocateHomePageLots({ railLots: [], pool: lots(12), moreLimit: 8 }).more).toHaveLength(
      8,
    );
  });

  it("excludes draft lots from the pool", () => {
    const pool = buildHomeCatalogLotPool(
      [],
      [...lots(3), baseLot({ id: "draft-1", status: "draft" })],
    );
    expect(allocateHomePageLots({ railLots: [], pool, moreLimit: 8 }).more).toEqual([]);
  });
});

describe("featured lots", () => {
  const lots = (n: number) => Array.from({ length: n }, (_, i) => baseLot({ id: `lot-${i}` }));
  const ids = (xs: Lot[]) => xs.map((l) => l.id);

  it("leads the rail with featured lots in staff order, then the current order", () => {
    const pool = lots(8);
    const { rail, more } = allocateHomePageLots({
      railLots: pool.slice(0, 3),
      pool,
      moreLimit: 8,
      featuredLotIds: ["lot-6", "lot-2"],
    });
    expect(ids(rail)).toEqual(["lot-6", "lot-2", "lot-0"]);
    expect(ids(more)).toEqual(["lot-1", "lot-3", "lot-4", "lot-5", "lot-7"]);
  });

  it("skips featured ids that are not in the pool", () => {
    const pool = lots(5);
    const { rail } = allocateHomePageLots({
      railLots: pool.slice(0, 2),
      pool,
      moreLimit: 8,
      featuredLotIds: ["gone", "lot-4"],
    });
    expect(ids(rail)).toEqual(["lot-4", "lot-0"]);
  });

  it("keeps the current order without featured lots", () => {
    const pool = lots(5);
    expect(
      ids(allocateHomePageLots({ railLots: pool.slice(0, 2), pool, moreLimit: 8 }).rail),
    ).toEqual(["lot-0", "lot-1"]);
  });
});

describe("the hang slot", () => {
  const lots = (n: number) => Array.from({ length: n }, (_, i) => baseLot({ id: `lot-${i}` }));
  const ids = (xs: Lot[]) => xs.map((l) => l.id);

  it("claims its lots before the rail and More lots, so neither repeats them", () => {
    const pool = lots(12);
    const { hang, rail, more } = allocateHomePageLots({
      railLots: pool.slice(0, 3),
      pool,
      moreLimit: 8,
      hangLots: pool.slice(0, 5),
      hangLimit: 12,
    });
    expect(ids(hang)).toEqual(["lot-0", "lot-1", "lot-2", "lot-3", "lot-4"]);
    expect(rail).toEqual([]);
    expect(ids(more)).toEqual(["lot-5", "lot-6", "lot-7", "lot-8", "lot-9", "lot-10", "lot-11"]);
  });

  it("takes lots outside the pool too, and keeps the hanging order", () => {
    const pool = lots(8);
    const outside = [baseLot({ id: "ended-1" }), baseLot({ id: "ended-2" })];
    const { hang } = allocateHomePageLots({
      railLots: [],
      pool,
      moreLimit: 8,
      hangLots: [...outside, pool[3] as Lot],
      hangLimit: 12,
    });
    expect(ids(hang)).toEqual(["ended-1", "ended-2", "lot-3"]);
  });

  it("stays empty, and claims nothing, with fewer than two lots to hang", () => {
    const pool = lots(8);
    const { hang, more } = allocateHomePageLots({
      railLots: [],
      pool,
      moreLimit: 8,
      hangLots: [pool[0] as Lot],
      hangLimit: 12,
    });
    expect(hang).toEqual([]);
    expect(ids(more)).toContain("lot-0");
  });

  it("respects the limit", () => {
    const pool = lots(20);
    expect(
      allocateHomePageLots({ railLots: [], pool, moreLimit: 8, hangLots: pool, hangLimit: 12 })
        .hang,
    ).toHaveLength(12);
  });

  it("is absent when the page has no hang", () => {
    expect(allocateHomePageLots({ railLots: [], pool: lots(5), moreLimit: 8 }).hang).toEqual([]);
  });
});

describe("homePinnedSaleIds", () => {
  it("orders pinned sales by pin order and skips unpinned ones", () => {
    expect(
      homePinnedSaleIds([
        { id: "c", homePinOrder: 3 },
        { id: "x", homePinOrder: null },
        { id: "a", homePinOrder: 1 },
        { id: "y" },
        { id: "b", homePinOrder: 2 },
      ]),
    ).toEqual(["a", "b", "c"]);
  });
});
