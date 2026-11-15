import { describe, expect, it, vi } from "vitest";
import { purgeFailedJobPayloads } from "./purge-failed-job-payloads.js";

const log = { info: vi.fn(), warn: vi.fn() };
const now = new Date("2026-11-15T03:00:00.000Z");

describe("purgeFailedJobPayloads", () => {
  it("clears payloads resolved more than 90 days before now", async () => {
    const purgeResolvedPayloads = vi.fn().mockResolvedValue(0);
    await purgeFailedJobPayloads({ purge: { purgeResolvedPayloads }, log, now });
    expect(purgeResolvedPayloads).toHaveBeenCalledWith(new Date("2026-08-17T03:00:00.000Z"), 500);
  });

  it("keeps going while batches come back full, and stops at the first short one", async () => {
    const purgeResolvedPayloads = vi
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    const result = await purgeFailedJobPayloads({
      purge: { purgeResolvedPayloads },
      log,
      now,
      batchSize: 2,
    });
    expect(result).toEqual({ cleared: 5, batches: 3 });
  });

  it("stops at 200 batches and warns, leaving the rest to the next run", async () => {
    const warn = vi.fn();
    const purgeResolvedPayloads = vi.fn().mockResolvedValue(500);
    const result = await purgeFailedJobPayloads({
      purge: { purgeResolvedPayloads },
      log: { info: vi.fn(), warn },
      now,
    });
    expect(result).toEqual({ cleared: 200 * 500, batches: 200 });
    expect(purgeResolvedPayloads).toHaveBeenCalledTimes(200);
    expect(warn).toHaveBeenCalledWith(
      { cleared: 100_000, batches: 200 },
      expect.stringContaining("batch limit"),
    );
  });
});
