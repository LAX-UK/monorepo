import { describe, expect, it, vi } from "vitest";
import { processLotLifecycleJob } from "./process-lot-lifecycle-job.js";

describe("processLotLifecycleJob", () => {
  const executor = {
    lotLifecycleService: {
      processActivateJob: vi.fn(),
      processEndJob: vi.fn(),
    },
    saleLifecycleService: { reconcileSaleStatuses: vi.fn() },
  };

  it("routes activate jobs", async () => {
    await processLotLifecycleJob({
      jobName: "activate",
      lotId: "lot-1",
      executor: executor as never,
    });
    expect(executor.lotLifecycleService.processActivateJob).toHaveBeenCalledWith("lot-1");
  });

  it("routes end jobs", async () => {
    await processLotLifecycleJob({ jobName: "end", lotId: "lot-2", executor: executor as never });
    expect(executor.lotLifecycleService.processEndJob).toHaveBeenCalledWith("lot-2");
  });

  it("rejects unknown job names", async () => {
    await expect(
      processLotLifecycleJob({ jobName: "nope", lotId: "lot-3", executor: executor as never }),
    ).rejects.toThrow(/unknown_lot_lifecycle_job/);
  });
});
