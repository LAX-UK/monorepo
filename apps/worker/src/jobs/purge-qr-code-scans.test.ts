import { describe, expect, it, vi } from "vitest";
import { purgeQrCodeScans } from "./purge-qr-code-scans.js";

describe("purgeQrCodeScans", () => {
  it("deletes stale raw scan rows in batches", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "scan-1" }, { id: "scan-2" }]);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValueOnce([{ id: "scan-1" }, { id: "scan-2" }])
              .mockResolvedValueOnce([]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning }),
      }),
    };

    const result = await purgeQrCodeScans({
      db: db as never,
      log: { info: vi.fn() } as never,
      retentionDays: 90,
      batchSize: 2,
      now: new Date("2026-05-31T00:00:00.000Z"),
    });

    expect(result.deleted).toBe(2);
    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(result.cutoff.toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });
});
