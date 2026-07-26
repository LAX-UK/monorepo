import type { Logger } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IMarketingAttributionPurgeRepository } from "../interfaces/marketing-attribution-purge.repository.js";
import { purgeStaleMarketingAttribution } from "./purge-stale-marketing-attribution.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("purgeStaleMarketingAttribution", () => {
  it("purges stale rows through the repository and reports the count", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T00:00:00.000Z"));
    const purgeStale = vi.fn().mockResolvedValue(2);
    const info = vi.fn();

    await expect(
      purgeStaleMarketingAttribution({
        marketingAttributionPurgeRepo: { purgeStale } as IMarketingAttributionPurgeRepository,
        log: { info } as unknown as Logger,
      }),
    ).resolves.toBe(2);

    expect(purgeStale).toHaveBeenCalledWith(new Date("2026-04-26T00:00:00.000Z"));
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 2,
        staleBefore: new Date("2026-04-26T00:00:00.000Z"),
      }),
      "purged stale marketing attribution snapshots",
    );
  });
});
