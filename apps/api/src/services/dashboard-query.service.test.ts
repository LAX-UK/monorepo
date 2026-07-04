import type { IRepositoryFactory } from "@auction/persistence";
import type { Bid, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { DashboardQueryService } from "./dashboard-query.service.js";

describe("DashboardQueryService.listBidsWithLotsForBidder", () => {
  it("loads lots in a single findByIds call", async () => {
    const findByIds = vi.fn().mockResolvedValue([{ id: "lot-1" } as Lot]);
    const listForBidder = vi
      .fn()
      .mockResolvedValue([
        { id: "bid-1", lotId: "lot-1" } as Bid,
        { id: "bid-2", lotId: "lot-1" } as Bid,
      ]);
    const repos: IRepositoryFactory = {
      root: {
        bid: { listForBidder },
        lot: { findByIds },
      },
    } as unknown as IRepositoryFactory;

    const service = new DashboardQueryService(repos);
    const rows = await service.listBidsWithLotsForBidder("bidder-1");

    expect(findByIds).toHaveBeenCalledTimes(1);
    expect(findByIds).toHaveBeenCalledWith(["lot-1"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.lot?.id).toBe("lot-1");
  });
});
