import { describe, expect, it, vi } from "vitest";
import { AtgGatewayError } from "./atg-gateway.js";
import { isPermanentAtgJobError, processAtgSyncJob } from "./atg-sync-job.js";
import { AtgSyncPreconditionError, type AtgSyncService } from "./atg-sync-service.js";

function fakeService() {
  return {
    pushSale: vi.fn(async () => ({ created: 1, updated: 0, unchanged: 0, deleted: 0, failed: 0 })),
    publishSale: vi.fn(async () => undefined),
    closeSale: vi.fn(async () => undefined),
    deleteLot: vi.fn(async () => undefined),
    tick: vi.fn(async () => ({ pushed: 0, polled: 0, failed: 0 })),
  };
}

describe("processAtgSyncJob", () => {
  it.each([
    ["atg.push-sale", { saleId: "s1" }, "pushSale", "s1"],
    ["atg.publish-sale", { saleId: "s1" }, "publishSale", "s1"],
    ["atg.close-sale", { saleId: "s1" }, "closeSale", "s1"],
    ["atg.delete-lot", { lotId: "l1" }, "deleteLot", "l1"],
  ] as const)("routes %s", async (name, data, method, arg) => {
    const service = fakeService();
    await processAtgSyncJob({ name, data }, service as unknown as AtgSyncService);
    expect(service[method]).toHaveBeenCalledWith(arg);
  });

  it("routes the repeatable tick", async () => {
    const service = fakeService();
    await expect(
      processAtgSyncJob({ name: "atg.tick", data: {} }, service as unknown as AtgSyncService),
    ).resolves.toEqual({ pushed: 0, polled: 0, failed: 0 });
  });

  it("rejects unknown jobs and missing ids as permanent failures", async () => {
    const service = fakeService() as unknown as AtgSyncService;
    const unknown = await processAtgSyncJob({ name: "nope", data: {} }, service).catch((e) => e);
    const missing = await processAtgSyncJob({ name: "atg.push-sale", data: {} }, service).catch(
      (e) => e,
    );
    expect(isPermanentAtgJobError(unknown)).toBe(true);
    expect(isPermanentAtgJobError(missing)).toBe(true);
  });
});

describe("isPermanentAtgJobError", () => {
  it("retries transient gateway errors and unknown failures", () => {
    expect(isPermanentAtgJobError(new AtgGatewayError("x", true, 503, "op"))).toBe(false);
    expect(isPermanentAtgJobError(new Error("db down"))).toBe(false);
    expect(isPermanentAtgJobError(new AtgGatewayError("x", false, 400, "op"))).toBe(true);
    expect(isPermanentAtgJobError(new AtgSyncPreconditionError("x"))).toBe(true);
  });
});
