import {
  HOME_ENDING_SOON_WINDOW_MS,
  lotsEndingSoon,
  nextUpcomingLots,
} from "@/components/sections/home/home-urgency-helpers";
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

describe("lotsEndingSoon", () => {
  const now = Date.parse("2026-01-02T00:00:00.000Z");

  it("includes active lots ending within the window", () => {
    const lots = [
      baseLot({
        id: "a",
        endTime: new Date("2026-01-02T12:00:00.000Z"),
        status: "active",
      }),
    ];
    expect(lotsEndingSoon(lots, { nowMs: now, windowMs: HOME_ENDING_SOON_WINDOW_MS })).toHaveLength(
      1,
    );
  });

  it("excludes lots ending after the 24h window", () => {
    const lots = [
      baseLot({
        id: "far",
        endTime: new Date("2026-01-05T00:00:00.000Z"),
        status: "active",
      }),
    ];
    expect(lotsEndingSoon(lots, { nowMs: now, windowMs: HOME_ENDING_SOON_WINDOW_MS })).toHaveLength(
      0,
    );
  });

  it("excludes non-active lots", () => {
    const lots = [
      baseLot({
        id: "sched",
        endTime: new Date("2026-01-02T06:00:00.000Z"),
        status: "scheduled",
      }),
    ];
    expect(lotsEndingSoon(lots, { nowMs: now })).toHaveLength(0);
  });
});

describe("nextUpcomingLots", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");

  it("returns future-start lots sorted by start time ascending", () => {
    const lots = [
      baseLot({
        id: "later",
        status: "scheduled",
        startTime: new Date("2026-01-10T12:00:00.000Z"),
        endTime: new Date("2026-01-11T12:00:00.000Z"),
      }),
      baseLot({
        id: "sooner",
        status: "scheduled",
        startTime: new Date("2026-01-02T12:00:00.000Z"),
        endTime: new Date("2026-01-03T12:00:00.000Z"),
      }),
    ];
    const picked = nextUpcomingLots(lots, 4, now);
    expect(picked.map((l) => l.id)).toEqual(["sooner", "later"]);
  });

  it("respects limit", () => {
    const lots = [
      baseLot({
        id: "a",
        status: "scheduled",
        startTime: new Date("2026-01-02T12:00:00.000Z"),
        endTime: new Date("2026-01-03T12:00:00.000Z"),
      }),
      baseLot({
        id: "b",
        status: "scheduled",
        startTime: new Date("2026-01-03T12:00:00.000Z"),
        endTime: new Date("2026-01-04T12:00:00.000Z"),
      }),
    ];
    expect(nextUpcomingLots(lots, 1, now)).toHaveLength(1);
    expect(nextUpcomingLots(lots, 1, now)[0]?.id).toBe("a");
  });

  it("drops lots that already started", () => {
    const lots = [
      baseLot({
        id: "past",
        status: "scheduled",
        startTime: new Date("2025-12-01T12:00:00.000Z"),
        endTime: new Date("2026-01-03T12:00:00.000Z"),
      }),
    ];
    expect(nextUpcomingLots(lots, 4, now)).toHaveLength(0);
  });
});
