import type { Database } from "@auction/db";
import type { FastifyBaseLogger } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createShopScheduler } from "./create-shop-scheduler.js";
import { runWithShopSchedulerLock } from "./shop-scheduler-lock.js";

function fakeDb(client: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }) {
  const connect = vi.fn().mockResolvedValue(client);
  return { db: { $client: { connect } } as unknown as Database, connect };
}

const lockResult = (acquired: boolean) => ({ rows: [{ acquired }] });

describe("runWithShopSchedulerLock", () => {
  it("runs the work, unlocks and returns the connection", async () => {
    const query = vi.fn().mockResolvedValueOnce(lockResult(true)).mockResolvedValueOnce({});
    const release = vi.fn();
    const { db } = fakeDb({ query, release });
    const fn = vi.fn().mockResolvedValue(undefined);

    await expect(runWithShopSchedulerLock(db, fn)).resolves.toBe(true);

    expect(fn).toHaveBeenCalledOnce();
    expect(query.mock.calls[1]?.[0]).toContain("pg_advisory_unlock");
    expect(release).toHaveBeenCalledWith(undefined);
  });

  it("returns the connection without running when another replica holds the lock", async () => {
    const query = vi.fn().mockResolvedValueOnce(lockResult(false));
    const release = vi.fn();
    const { db } = fakeDb({ query, release });
    const fn = vi.fn();

    await expect(runWithShopSchedulerLock(db, fn)).resolves.toBe(false);

    expect(fn).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith(undefined);
  });

  it("destroys the connection when the lock query fails", async () => {
    const failure = new Error("Connection terminated unexpectedly");
    const query = vi.fn().mockRejectedValueOnce(failure);
    const release = vi.fn();
    const { db } = fakeDb({ query, release });

    await expect(runWithShopSchedulerLock(db, vi.fn())).rejects.toBe(failure);

    expect(release).toHaveBeenCalledWith(failure);
  });

  it("destroys the connection when the unlock fails, so the server drops the session lock", async () => {
    const failure = new Error("unlock failed");
    const query = vi.fn().mockResolvedValueOnce(lockResult(true)).mockRejectedValueOnce(failure);
    const release = vi.fn();
    const { db } = fakeDb({ query, release });

    await expect(runWithShopSchedulerLock(db, vi.fn().mockResolvedValue(undefined))).resolves.toBe(
      true,
    );

    expect(release).toHaveBeenCalledWith(failure);
  });
});

describe("createShopScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("logs a warning and tries again next interval when the connection cannot be had", async () => {
    vi.useFakeTimers();
    const query = vi.fn().mockResolvedValue(lockResult(true));
    const release = vi.fn();
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection terminated due to connection timeout"))
      .mockResolvedValue({ query, release });
    const db = { $client: { connect } } as unknown as Database;
    const warn = vi.fn();
    const log = { warn, error: vi.fn() } as unknown as FastifyBaseLogger;
    const run = vi.fn().mockResolvedValue(undefined);

    const scheduler = createShopScheduler({
      db,
      log,
      intervalMs: 1000,
      tasks: [{ name: "task", run }],
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(warn).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(run).toHaveBeenCalledOnce();
    scheduler.stop();
  });
});
