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
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockReturnValueOnce({ limit: vi.fn().mockResolvedValue([staleRow]) })
            .mockReturnValueOnce({ limit: vi.fn().mockResolvedValue([]) })
            .mockReturnValueOnce({ limit: vi.fn().mockResolvedValue([]) }),
        }),
      }),
      update: vi.fn().mockReturnValue({ set }),
      delete: vi.fn(),
    };

    const result = await purgeExpiredExportsJob({
      db: db as never,
      storage: { deleteObject: vi.fn() } as never,
      log: { info: vi.fn() },
      staleProcessingMs: 1_800_000,
    });

    expect(result.markedFailed).toBe(1);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorMessage: "Export timed out",
      }),
    );
  });
});
