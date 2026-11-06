import type { Bid, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { DashboardQueryService } from "./dashboard-query.service.js";
import { UserDashboardReadService } from "./user-dashboard-read.service.js";
import type { WatchlistService } from "./watchlist.service.js";

describe("UserDashboardReadService", () => {
  it("batch-presents images and checkout pricing for bids", async () => {
    const lot = { id: "lot-1", saleId: "sale-1", images: ["img-key"] } as Lot;
    const dashboardQuery = {
      listBidsWithLotsForBidder: vi.fn().mockResolvedValue([{ bid: { id: "b1" } as Bid, lot }]),
    } as unknown as DashboardQueryService;
    const watchlistService = {} as WatchlistService;
    const resolveManyUnique = vi.fn(async (keys: string[]) => {
      const map = new Map<string, string>();
      for (const key of keys) map.set(key, "https://cdn/img.jpg");
      return map;
    });
    const saleLookup = {
      findByIds: vi.fn().mockResolvedValue([{ id: "sale-1", buyerPremiumRate: "0.25" }]),
    };

    const service = new UserDashboardReadService(
      dashboardQuery,
      watchlistService,
      { resolveManyUnique } as never,
      saleLookup,
    );
    const rows = await service.listBidsForUser("user-1");

    expect(resolveManyUnique).toHaveBeenCalledWith(["img-key"]);
    expect(saleLookup.findByIds).toHaveBeenCalledWith(["sale-1"]);
    expect(rows[0]?.lot?.checkoutPricing).toBeDefined();
  });

  it("shows an invoiced lot at the invoice's figures, not at its price now", async () => {
    const lot = {
      id: "lot-1",
      saleId: null,
      images: [],
      currentPrice: "9999.00",
      buyerPremiumRate: "0.25",
      winnerId: "user-1",
      buyerLegalEntityId: "acct-1",
    } as unknown as Lot;
    const unsold = { ...lot, id: "lot-2", winnerId: null, buyerLegalEntityId: null } as Lot;
    const dashboardQuery = {
      listBidsWithLotsForBidder: vi.fn().mockResolvedValue([
        { bid: { id: "b1" } as Bid, lot },
        { bid: { id: "b2" } as Bid, lot: unsold },
      ]),
    } as unknown as DashboardQueryService;
    const findLive = vi.fn(async (lotId: string) =>
      lotId === "lot-1"
        ? {
            totalPence: 125_000,
            pricingPolicyId: "flat:0.25",
            lines: [
              { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 100_000 },
              {
                kind: "buyers_premium",
                label: "Buyer's premium (25%)",
                ratePercent: "25",
                amountPence: 25_000,
              },
            ],
          }
        : null,
    );

    const service = new UserDashboardReadService(
      dashboardQuery,
      {} as WatchlistService,
      undefined,
      { findByIds: vi.fn().mockResolvedValue([]) },
      undefined,
      { findLiveByLotAndBuyerAccount: findLive as never },
    );
    const rows = await service.listBidsForUser("user-1");

    expect(rows[0]?.lot?.checkoutPricing).toMatchObject({
      hammerMajor: "1000.00",
      premiumMajor: "250.00",
      totalMajor: "1250.00",
    });
    // A lot nobody has won has no invoice to read, and is priced as it stands.
    expect(findLive).toHaveBeenCalledTimes(1);
    expect(rows[1]?.lot?.checkoutPricing?.hammerMajor).toBe("9999.00");
  });
});
