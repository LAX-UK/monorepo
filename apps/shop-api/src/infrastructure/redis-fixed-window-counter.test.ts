import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import { createRedisFixedWindowCounter } from "./redis-fixed-window-counter.js";

function fakeRedis(exec: () => Promise<Array<[Error | null, unknown]> | null>) {
  const calls: unknown[][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
      return chain;
    };
  const chain = { set: record("set"), incr: record("incr"), ttl: record("ttl"), exec: vi.fn(exec) };
  return { redis: { multi: () => chain } as unknown as Redis, calls };
}

describe("redis fixed-window counter", () => {
  it("starts the window with SET NX EX, then increments and reads the remaining ttl", async () => {
    const { redis, calls } = fakeRedis(async () => [
      [null, "OK"],
      [null, 3],
      [null, 1200],
    ]);
    const hit = await createRedisFixedWindowCounter(redis).increment("enquiry:ip:1.2.3.4", 3600);
    expect(hit).toEqual({ count: 3, resetInSeconds: 1200 });
    expect(calls).toEqual([
      ["set", "shop-api:rate:enquiry:ip:1.2.3.4", 0, "EX", 3600, "NX"],
      ["incr", "shop-api:rate:enquiry:ip:1.2.3.4"],
      ["ttl", "shop-api:rate:enquiry:ip:1.2.3.4"],
    ]);
  });

  it("falls back to the full window when the key has no expiry", async () => {
    const { redis } = fakeRedis(async () => [
      [null, null],
      [null, 1],
      [null, -1],
    ]);
    expect(await createRedisFixedWindowCounter(redis).increment("k", 60)).toEqual({
      count: 1,
      resetInSeconds: 60,
    });
  });

  it("throws when the transaction aborts or a command fails, so the caller can fail open", async () => {
    const aborted = fakeRedis(async () => null);
    await expect(createRedisFixedWindowCounter(aborted.redis).increment("k", 60)).rejects.toThrow(
      /aborted/,
    );
    const failed = fakeRedis(async () => [[new Error("READONLY"), null]]);
    await expect(createRedisFixedWindowCounter(failed.redis).increment("k", 60)).rejects.toThrow(
      "READONLY",
    );
  });
});
