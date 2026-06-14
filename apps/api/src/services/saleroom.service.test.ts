import { describe, expect, it, vi } from "vitest";
import { SaleroomService } from "./saleroom.service.js";

describe("SaleroomService.goLive", () => {
  it("rejects online sales", async () => {
    const saleRepo = {
      findById: vi.fn().mockResolvedValue({
        id: "sale-online",
        deliveryMode: "online",
        status: "active",
      }),
    };
    const service = new SaleroomService({
      db: {} as never,
      redis: { publish: vi.fn() } as never,
      lotLifecycle: {} as never,
      saleRepo: saleRepo as never,
      lotRepo: {} as never,
      lotJobs: null,
    });

    const result = await service.goLive({ saleId: "sale-online", actorUserId: "staff-1" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(400);
      expect(result.error.message).toContain("onsite and hybrid");
    }
  });
});
