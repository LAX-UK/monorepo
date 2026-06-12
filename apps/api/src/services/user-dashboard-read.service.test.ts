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
    const resolveMany = vi.fn().mockResolvedValue(["https://cdn/img.jpg"]);
    const saleLookup = {
      findByIds: vi.fn().mockResolvedValue([{ id: "sale-1", buyerPremiumRate: "0.25" }]),
    };

    const service = new UserDashboardReadService(
      dashboardQuery,
      watchlistService,
      { resolveMany } as never,
      saleLookup,
    );
    const rows = await service.listBidsForUser("user-1");

    expect(resolveMany).toHaveBeenCalledWith(["img-key"]);
    expect(saleLookup.findByIds).toHaveBeenCalledWith(["sale-1"]);
    expect(rows[0]?.lot?.checkoutPricing).toBeDefined();
  });
});
