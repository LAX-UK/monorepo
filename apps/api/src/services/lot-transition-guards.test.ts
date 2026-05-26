import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { LotTransitionGuards } from "./lot-transition-guards.js";

describe("LotTransitionGuards.assertReturnToInventoryAllowed", () => {
  it("blocks when payment records exist", async () => {
    const guards = new LotTransitionGuards({} as Database);
    vi.spyOn(guards, "countForLot").mockResolvedValue({
      paymentCount: 1,
      openDisputeCount: 0,
      fulfilmentInProgress: false,
      activeBidCount: 0,
    });

    await expect(guards.assertReturnToInventoryAllowed("lot-1")).resolves.toMatch(
      /payment records/,
    );
  });

  it("allows when no blocking conditions", async () => {
    const guards = new LotTransitionGuards({} as Database);
    vi.spyOn(guards, "countForLot").mockResolvedValue({
      paymentCount: 0,
      openDisputeCount: 0,
      fulfilmentInProgress: false,
      activeBidCount: 3,
    });

    await expect(guards.assertReturnToInventoryAllowed("lot-1")).resolves.toBeNull();
  });
});
