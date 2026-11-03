import {
  allocateHomePageLots,
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

const lots = (n: number, prefix = "lot") =>
  Array.from({ length: n }, (_, i) => baseLot({ id: `${prefix}-${i}` }));
const ids = (xs: Lot[]) => xs.map((l) => l.id);
const sizes = { railLimit: 8, railMin: 4, railRow: 4, resultsLimit: 4, resultsMin: 2 };

describe("allocateHomePageLots", () => {
  it("reserves the hero's lots first, so nothing below repeats them", () => {
    const pool = lots(12);
    const { hang, rail } = allocateHomePageLots({
      ...sizes,
      heroLots: [pool[0] as Lot],
      hangLots: pool.slice(0, 4),
      hangLimit: 12,
      railLots: pool,
    });
    expect(ids(hang)).toEqual(["lot-1", "lot-2", "lot-3"]);
    expect(ids(rail)).toEqual([
      "lot-4",
      "lot-5",
      "lot-6",
      "lot-7",
      "lot-8",
      "lot-9",
      "lot-10",
      "lot-11",
    ]);
  });

  it("gives the hang its lots before the rail, and keeps the hanging order", () => {
    const pool = lots(10);
    const { hang, rail } = allocateHomePageLots({
      ...sizes,
      hangLots: [pool[5] as Lot, pool[1] as Lot, pool[2] as Lot],
      hangLimit: 12,
      railLots: pool,
    });
    expect(ids(hang)).toEqual(["lot-5", "lot-1", "lot-2"]);
    expect(ids(rail)).not.toContain("lot-5");
    expect(ids(rail)).toHaveLength(4);
  });

  it("leaves the hang empty, claiming nothing, with fewer than two lots to hang", () => {
    const pool = lots(8);
    const { hang, rail } = allocateHomePageLots({
      ...sizes,
      hangLots: [pool[0] as Lot],
      hangLimit: 12,
      railLots: pool,
    });
    expect(hang).toEqual([]);
    expect(ids(rail)).toContain("lot-0");
  });

  it("hides the rail, and releases its lots, when fewer than the minimum remain", () => {
    const pool = lots(4);
    const { rail, results } = allocateHomePageLots({
      ...sizes,
      hangLots: pool.slice(0, 2),
      hangLimit: 12,
      railLots: pool,
      resultsLots: pool,
    });
    expect(rail).toEqual([]);
    expect(ids(results)).toEqual(["lot-2", "lot-3"]);
  });

  it("gives the results band lots the rail did not use, up to its limit", () => {
    const rail = lots(8, "rail");
    const sold = lots(10, "sold");
    const placed = allocateHomePageLots({
      ...sizes,
      railLots: rail,
      resultsLots: [...rail, ...sold],
    });
    expect(ids(placed.results)).toEqual(["sold-0", "sold-1", "sold-2", "sold-3"]);
  });

  it("rounds the rail down to whole rows and gives the rest to the results band", () => {
    const pool = lots(6);
    const { rail, results } = allocateHomePageLots({ ...sizes, railLots: pool, resultsLots: pool });
    expect(ids(rail)).toEqual(["lot-0", "lot-1", "lot-2", "lot-3"]);
    expect(ids(results)).toEqual(["lot-4", "lot-5"]);
  });

  it("respects the hang limit", () => {
    const pool = lots(20);
    expect(allocateHomePageLots({ ...sizes, hangLots: pool, hangLimit: 12 }).hang).toHaveLength(12);
  });

  it("is empty when the page has no candidates", () => {
    expect(allocateHomePageLots(sizes)).toEqual({ hang: [], rail: [], results: [] });
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
