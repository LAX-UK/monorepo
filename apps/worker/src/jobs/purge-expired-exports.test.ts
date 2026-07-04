import { describe, expect, it, vi } from "vitest";
import { purgeExpiredExportsJob } from "./purge-expired-exports.js";

describe("purgeExpiredExportsJob", () => {
  it("marks stale pending/processing exports as failed", async () => {
    const staleRow = {
      id: "exp-stale",
      status: "processing",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      s3Key: null,
    };
    const markTimedOut = vi.fn().mockResolvedValue(undefined);
    const dataExportRepo = {
      findStuckProcessing: vi.fn().mockResolvedValue([staleRow]),
      markTimedOut,
      findExpired: vi.fn().mockResolvedValue([]),
      findOlderThan: vi.fn().mockResolvedValue([]),
    };

    const result = await purgeExpiredExportsJob({
      dataExportRepo: dataExportRepo as never,
      storage: { deleteObject: vi.fn() } as never,
      log: { info: vi.fn() },
      staleProcessingMs: 1_800_000,
    });

    expect(result.markedFailed).toBe(1);
    expect(markTimedOut).toHaveBeenCalledWith("exp-stale");
  });
});
