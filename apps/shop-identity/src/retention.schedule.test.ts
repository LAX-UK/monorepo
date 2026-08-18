import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SHOP_RETENTION_BATCH_SIZE,
  SHOP_SESSION_RETENTION_DAYS,
  purgeShopRetentionBatch,
  startShopRetentionSchedule,
} from "./retention.schedule.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("Shop retention", () => {
  it("purges only Shop-owned tables in bounded batches", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0 });
    const now = new Date("2026-08-13T00:00:00Z");
    await purgeShopRetentionBatch({ query } as unknown as Pick<Pool, "query">, now);

    expect(SHOP_RETENTION_BATCH_SIZE).toBe(500);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      expect.stringContaining("shop_identity_session"),
      expect.stringContaining("shop_logout_token_replay"),
      expect.stringContaining("shop_ssf_replay"),
    ]);
    for (const [, parameters] of query.mock.calls) {
      expect(parameters?.[1]).toBe(SHOP_RETENTION_BATCH_SIZE);
    }
    expect(query.mock.calls[0]?.[1]?.[0]).toEqual(
      new Date(now.getTime() - SHOP_SESSION_RETENTION_DAYS * 24 * 60 * 60_000),
    );
    expect(query.mock.calls[1]?.[1]?.[0]).toEqual(now);
    expect(query.mock.calls[2]?.[1]?.[0]).toEqual(now);
  });

  it("prevents overlap and waits for the active purge when stopped", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const query = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = () => resolve({ rowCount: 0 });
          }),
      )
      .mockResolvedValue({ rowCount: 0 });
    const schedule = startShopRetentionSchedule({
      pool: { query } as unknown as Pick<Pool, "query">,
      onError: vi.fn(),
      intervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(40);
    expect(query).toHaveBeenCalledOnce();

    const stopped = schedule.stop();
    let completed = false;
    void stopped.then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);

    finish?.();
    await stopped;
    expect(completed).toBe(true);
  });
});
