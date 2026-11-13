import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AdminLotDetailMetricsService } from "./admin-lot-detail-metrics.service.js";

const lot = (over: Partial<Lot> = {}) =>
  ({
    id: "lot-1",
    currentPrice: "1000.00",
    startingPrice: "100.00",
    reservePrice: null,
    buyerPremiumRate: "0.25",
    marketingDetails: {},
    ...over,
  }) as Lot;

function service(row: Lot | null) {
  const lotRepo = { findById: vi.fn(async () => row) };
  const bidRepo = {
    countForLot: vi.fn(async () => 2),
    listDistinctBidderIds: vi.fn(async () => ["a", "b"]),
  };
  return new AdminLotDetailMetricsService(lotRepo as never, bidRepo as never);
}

describe("AdminLotDetailMetricsService", () => {
  it("reports the lot's figures without a buyer's premium label (priced through the resolver elsewhere)", async () => {
    const metrics = await service(lot()).getMetrics("lot-1");
    expect(metrics).toMatchObject({ currentHammer: "1000.00", bidCount: 2, uniqueBidders: 2 });
    // The lot's own rate is not surfaced here: a rate would bypass the premium resolver.
    expect(metrics).not.toHaveProperty("buyerPremiumLabel");
  });

  it("marks the reserve met once a bid reaches it", async () => {
    const metrics = await service(lot({ reservePrice: "800.00" })).getMetrics("lot-1");
    expect(metrics?.reserveMet).toBe(true);
  });
});
