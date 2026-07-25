import type { Database } from "@auction/db";
import { marketingAttribution } from "@auction/db/schema";
import type { Logger } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { purgeStaleMarketingAttribution } from "./purge-stale-marketing-attribution.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("purgeStaleMarketingAttribution", () => {
  it("deletes stale rows and reports the count", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T00:00:00.000Z"));
    const returning = vi.fn().mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
    const where = vi.fn(() => ({ returning }));
    const deleteFn = vi.fn(() => ({ where }));
    const info = vi.fn();

    await expect(
      purgeStaleMarketingAttribution({
        db: { delete: deleteFn } as unknown as Database,
        log: { info } as unknown as Logger,
      }),
    ).resolves.toBe(2);

    expect(deleteFn).toHaveBeenCalledWith(marketingAttribution);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 2,
        staleBefore: new Date("2026-04-26T00:00:00.000Z"),
      }),
      "purged stale marketing attribution snapshots",
    );
  });
});
