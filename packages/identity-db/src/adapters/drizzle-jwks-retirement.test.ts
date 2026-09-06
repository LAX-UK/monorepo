import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jwksKey } from "../schema/jwks-key.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";
import { retireExpiredJwksKeys, startJwksRetirementSchedule } from "./drizzle-jwks-retirement.js";

const dialect = new PgDialect();

function createMockDb() {
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const execute = vi.fn();
  const tx = { execute, update };
  type Tx = { execute: typeof execute; update: typeof update };
  const transaction = vi.fn(async (callback: (tx: Tx) => Promise<void>) => callback(tx));

  return {
    db: { execute, transaction, update } as unknown as IdentityDatabase,
    execute,
    set,
    transaction,
    update,
    where,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("retireExpiredJwksKeys", () => {
  it("retires rotating keys older than the retirement window", async () => {
    const { db, set, update, where } = createMockDb();
    const now = new Date("2026-05-03T18:39:59.062Z");

    await retireExpiredJwksKeys(db, now);

    expect(update).toHaveBeenCalledWith(jwksKey);
    expect(set).toHaveBeenCalledWith({ status: "retired" });

    const predicate = (where.mock.calls as unknown[][])[0]?.[0] as SQL;
    const query = dialect.sqlToQuery(predicate);
    expect(query.sql).toBe(`("jwks_key"."status" = $1 and "jwks_key"."rotated_at" < $2)`);
    expect(query.params).toEqual(["rotating", "2026-05-03T18:09:59.062Z"]);
  });
});

describe("startJwksRetirementSchedule", () => {
  it("takes a transaction-scoped advisory lock before retirement (no explicit unlock)", async () => {
    vi.useFakeTimers();
    const { db, execute, transaction, update } = createMockDb();
    const log = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };

    execute.mockResolvedValueOnce({ rows: [{ lock_acquired: true }] });

    const schedule = startJwksRetirementSchedule({
      db,
      intervalMs: 10,
      lockKey: 123n,
      log,
    });

    await vi.advanceTimersByTimeAsync(10);
    schedule.stop();

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
    const lockQuery = dialect.sqlToQuery(execute.mock.calls[0]?.[0] as SQL);
    expect(lockQuery.sql).toBe("select pg_try_advisory_xact_lock($1::bigint) as lock_acquired");
    expect(lockQuery.params).toEqual(["123"]);
    expect(update).toHaveBeenCalledWith(jwksKey);
    expect(log.info).toHaveBeenCalledWith({ lockKey: "123" }, "jwks_retirement_tick");
    expect(log.error).not.toHaveBeenCalled();
  });
});
