import { describe, expect, it, vi } from "vitest";
import {
  DATA_REQUEST_RETENTION_BATCH_SIZE,
  clearExpiredRequestContacts,
  startDataRequestRetentionSchedule,
} from "./data-request-retention.schedule.js";

const NOW = new Date("2026-11-02T12:00:00.000Z");

describe("clearExpiredRequestContacts", () => {
  it("clears requests closed on or before the retention date, counted in London days", async () => {
    const clearContacts = vi.fn(async () => ["DR-0001"]);
    const cleared = await clearExpiredRequestContacts({ clearContacts }, 730, NOW);
    expect(cleared).toEqual(["DR-0001"]);
    expect(clearContacts).toHaveBeenCalledWith(
      "2024-11-02",
      NOW,
      DATA_REQUEST_RETENTION_BATCH_SIZE,
    );
  });

  it("follows the configured period", async () => {
    const clearContacts = vi.fn(async () => []);
    await clearExpiredRequestContacts({ clearContacts }, 365, NOW);
    expect(clearContacts).toHaveBeenCalledWith(
      "2025-11-02",
      NOW,
      DATA_REQUEST_RETENTION_BATCH_SIZE,
    );
  });
});

describe("startDataRequestRetentionSchedule", () => {
  it("runs at once, reports what it cleared, and reports a failure without stopping", async () => {
    const clearContacts = vi
      .fn<(...args: unknown[]) => Promise<string[]>>()
      .mockResolvedValue([])
      .mockResolvedValueOnce(["DR-0001", "DR-0002"])
      .mockRejectedValueOnce(new Error("db down"));
    const onCleared = vi.fn();
    const onError = vi.fn();
    const schedule = startDataRequestRetentionSchedule({
      writer: { clearContacts },
      retentionDays: 730,
      onCleared,
      onError,
      intervalMs: 5,
      now: () => NOW,
    });
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "db down" })),
    );
    await schedule.stop();
    expect(onCleared).toHaveBeenCalledWith(2);
  });
});
