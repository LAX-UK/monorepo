import type { Database } from "@auction/db";
import { jwksKey } from "@auction/db";
import { afterEach, describe, expect, it, vi } from "vitest";

const orm = vi.hoisted(() => ({
  and: vi.fn((...conditions: unknown[]) => ({ kind: "and", conditions })),
  eq: vi.fn((column: unknown, value: unknown) => ({ kind: "eq", column, value })),
  lt: vi.fn((column: unknown, value: unknown) => ({ kind: "lt", column, value })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    kind: "sql",
    strings: Array.from(strings),
    values,
  })),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: orm.and,
    eq: orm.eq,
    lt: orm.lt,
    sql: orm.sql,
  };
});

const { retireExpiredJwksKeys, startJwksRetirementSchedule } = await import("./jwks-retirement.js");

function createMockDb() {
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const execute = vi.fn();
  const tx = { execute, update };
  type Tx = { execute: typeof execute; update: typeof update };
  const transaction = vi.fn(async (callback: (tx: Tx) => Promise<void>) => callback(tx));

  return {
    db: { execute, transaction, update } as unknown as Database,
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

    const predicate = (where.mock.calls as unknown[][])[0]?.[0] as {
      kind: string;
      conditions: Array<{ kind: string; column: unknown; value: unknown }>;
    };
    expect(predicate.kind).toBe("and");
    expect(predicate.conditions[0]).toMatchObject({
      kind: "eq",
      column: jwksKey.status,
      value: "rotating",
    });
    expect(predicate.conditions[1]).toMatchObject({
      kind: "lt",
      column: jwksKey.rotatedAt,
      value: new Date("2026-05-03T18:09:59.062Z"),
    });
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
    expect(execute.mock.calls[0]?.[0]).toMatchObject({
      kind: "sql",
      values: ["123"],
    });
    expect(update).toHaveBeenCalledWith(jwksKey);
    expect(log.info).toHaveBeenCalledWith({ lockKey: "123" }, "jwks_retirement_tick");
    expect(log.error).not.toHaveBeenCalled();
  });
});
