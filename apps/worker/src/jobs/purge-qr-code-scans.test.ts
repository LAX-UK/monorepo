import { describe, expect, it, vi } from "vitest";
import { purgeQrCodeScans } from "./purge-qr-code-scans.js";

describe("purgeQrCodeScans", () => {
  it("deletes stale raw scan rows in batches", async () => {
    const purgeBefore = vi
      .fn()
      .mockResolvedValueOnce({ deleted: 2, batchCount: 2 })
      .mockResolvedValueOnce({ deleted: 0, batchCount: 0 });

    const result = await purgeQrCodeScans({
      qrCodeScanPurgeRepo: { purgeBefore },
      log: { info: vi.fn() } as never,
      retentionDays: 90,
      batchSize: 2,
      now: new Date("2026-05-31T00:00:00.000Z"),
    });

    expect(result.deleted).toBe(2);
    expect(purgeBefore).toHaveBeenCalledTimes(2);
    expect(result.cutoff.toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });
});
