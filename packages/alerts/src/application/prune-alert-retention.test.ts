import { describe, expect, it, vi } from "vitest";
import {
  type AlertPruneCounts,
  type AlertRetentionStore,
  pruneAlertRetention,
} from "./prune-alert-retention.js";

const zero: AlertPruneCounts = {
  unconfirmed: 0,
  stopped: 0,
  suppressionsTrimmed: 0,
  matches: 0,
  digests: 0,
};
const log = () => ({ info: vi.fn(), error: vi.fn() });
const now = new Date("2026-11-06T03:00:00.000Z");

describe("pruneAlertRetention", () => {
  it("hands every store the cutoffs for now and reports its counts", async () => {
    const prune = vi.fn(async () => ({ ...zero, unconfirmed: 2 }));
    const result = await pruneAlertRetention({
      stores: [{ name: "bid", prune }],
      log: log(),
      now,
    });
    expect(prune).toHaveBeenCalledWith(
      expect.objectContaining({
        unconfirmedBefore: new Date("2026-10-07T03:00:00.000Z"),
        stoppedBefore: new Date("2024-11-06T03:00:00.000Z"),
        logsBefore: new Date("2026-08-08T03:00:00.000Z"),
      }),
      { dryRun: false },
    );
    expect(result.counts.bid?.unconfirmed).toBe(2);
  });

  it("passes the dry-run flag through", async () => {
    const prune = vi.fn(async () => zero);
    await pruneAlertRetention({ stores: [{ name: "x", prune }], log: log(), dryRun: true, now });
    expect(prune).toHaveBeenCalledWith(expect.anything(), { dryRun: true });
  });

  it("keeps pruning the other stores when one fails, then throws so the run retries", async () => {
    const ok = vi.fn(async () => zero);
    const stores: AlertRetentionStore[] = [
      {
        name: "bad",
        prune: async () => {
          throw new Error("db down");
        },
      },
      { name: "good", prune: ok },
    ];
    const l = log();
    await expect(pruneAlertRetention({ stores, log: l, now })).rejects.toThrow(/1 store/);
    expect(ok).toHaveBeenCalledOnce();
    expect(l.error).toHaveBeenCalledOnce();
  });
});
