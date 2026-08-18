import type { Database } from "@auction/db";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BID_SSF_RETENTION_BATCH_SIZE,
  purgeBidSsfReplayBatch,
  startBidSsfRetentionSchedule,
} from "./bid-ssf-retention.schedule.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("Bid SSF replay retention", () => {
  it("issues a bounded delete through the Bid database owner", async () => {
    const execute = vi.fn().mockResolvedValue({});
    const now = new Date("2026-08-13T00:00:00Z");
    await purgeBidSsfReplayBatch({ execute } as unknown as Pick<Database, "execute">, now);

    expect(BID_SSF_RETENTION_BATCH_SIZE).toBe(500);
    expect(execute).toHaveBeenCalledOnce();
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]?.[0]);
    expect(query.sql).toContain(`"expires_at" < $`);
    expect(query.sql).toContain("LIMIT $");
    expect(query.params).toEqual([now, BID_SSF_RETENTION_BATCH_SIZE]);
  });

  it("prevents overlap and waits for the active purge when stopped", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const execute = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({});
        }),
    );
    const schedule = startBidSsfRetentionSchedule({
      db: { execute } as unknown as Pick<Database, "execute">,
      onError: vi.fn(),
      intervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(40);
    expect(execute).toHaveBeenCalledOnce();

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
