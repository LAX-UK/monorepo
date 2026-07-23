import { describe, expect, it, vi } from "vitest";
import { LotLifecycleTransitionExecutor } from "./lot-lifecycle-transition-executor.service.js";

describe("LotLifecycleTransitionExecutor", () => {
  it("delegates staff lot status to sale status transition service", async () => {
    const { ok } = await import("neverthrow");
    const setLotStatus = vi.fn().mockResolvedValue(ok({ id: "lot-1" }));
    const executor = new LotLifecycleTransitionExecutor(
      { setLotStatus } as never,
      { cancel: vi.fn() } as never,
    );
    await executor.applyStaffLotStatus({
      role: "staff",
      saleId: "sale-1",
      lotId: "lot-1",
      status: "active",
    });
    expect(setLotStatus).toHaveBeenCalledWith(
      "staff",
      "sale-1",
      "lot-1",
      "active",
      undefined,
      undefined,
    );
  });
});
