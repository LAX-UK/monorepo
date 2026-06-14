import { describe, expect, it, vi } from "vitest";
import { SaleroomOnBlockPolicy } from "./saleroom-on-block.policy.js";

describe("SaleroomOnBlockPolicy", () => {
  const saleId = "sale-1";
  const lotId = "lot-on-block";

  it("returns ok when session is live and lot matches currentLotId", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ status: "live", currentLotId: lotId }]),
          }),
        }),
      }),
    };
    const policy = new SaleroomOnBlockPolicy(db as never);
    const result = await policy.assertLotOnBlock(saleId, lotId);
    expect(result.isOk()).toBe(true);
  });

  it("rejects when lot is not on block", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ status: "live", currentLotId: "other-lot" }]),
          }),
        }),
      }),
    };
    const policy = new SaleroomOnBlockPolicy(db as never);
    const result = await policy.assertLotOnBlock(saleId, lotId);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("lot_not_on_block");
    }
  });

  it("rejects when session is not live", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ status: "paused", currentLotId: lotId }]),
          }),
        }),
      }),
    };
    const policy = new SaleroomOnBlockPolicy(db as never);
    const result = await policy.assertLotOnBlock(saleId, lotId);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("lot_not_on_block");
    }
  });
});
