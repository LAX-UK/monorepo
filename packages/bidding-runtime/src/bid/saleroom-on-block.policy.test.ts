import { describe, expect, it, vi } from "vitest";
import { SaleroomOnBlockPolicy } from "./saleroom-on-block.policy.js";

function makeReader(session: { status: string; currentLotId: string | null } | null) {
  const connReader = {
    getSessionState: vi.fn().mockResolvedValue(session),
  };
  return {
    getSessionState: vi.fn().mockResolvedValue(session),
    forConnection: vi.fn().mockReturnValue(connReader),
  };
}

describe("SaleroomOnBlockPolicy", () => {
  const saleId = "sale-1";
  const lotId = "lot-on-block";

  it("returns ok when session is live and lot matches currentLotId", async () => {
    const policy = new SaleroomOnBlockPolicy(
      makeReader({ status: "live", currentLotId: lotId }) as never,
    );
    const result = await policy.assertLotOnBlock(saleId, lotId);
    expect(result.isOk()).toBe(true);
  });

  it("rejects when lot is not on block", async () => {
    const policy = new SaleroomOnBlockPolicy(
      makeReader({ status: "live", currentLotId: "other-lot" }) as never,
    );
    const result = await policy.assertLotOnBlock(saleId, lotId);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("lot_not_on_block");
    }
  });

  it("rejects when session is paused", async () => {
    const policy = new SaleroomOnBlockPolicy(
      makeReader({ status: "paused", currentLotId: lotId }) as never,
    );
    const result = await policy.assertLotOnBlock(saleId, lotId);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("saleroom_paused");
    }
  });

  it("rejects when session is not live", async () => {
    const policy = new SaleroomOnBlockPolicy(
      makeReader({ status: "scheduled", currentLotId: lotId }) as never,
    );
    const result = await policy.assertLotOnBlock(saleId, lotId);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("lot_not_on_block");
    }
  });
});
