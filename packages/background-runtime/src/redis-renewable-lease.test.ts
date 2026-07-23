import { describe, expect, it, vi } from "vitest";
import {
  acquireRenewableLease,
  releaseRenewableLease,
  renewRenewableLease,
} from "./redis-renewable-lease.js";

function mockRedis() {
  const store = new Map<string, string>();
  return {
    set: vi.fn(async (key: string, value: string, ...args: (string | number)[]) => {
      if (args.includes("NX") && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    }),
    eval: vi.fn(async (_script: string, _n: number, key: string, ...argv: string[]) => {
      const current = store.get(key);
      if (_script.includes("pexpire")) {
        return current === argv[0] ? 1 : 0;
      }
      if (current === argv[0]) {
        store.delete(key);
        return 1;
      }
      return 0;
    }),
    _store: store,
  };
}

describe("redis renewable lease", () => {
  it("stale owner cannot delete successor lease", async () => {
    const redis = mockRedis();
    const first = await acquireRenewableLease(redis as never, "lock", 1000);
    expect(first).not.toBeNull();
    if (!first) return;
    const second = await acquireRenewableLease(redis as never, "lock", 1000);
    expect(second).toBeNull();

    redis._store.set("lock", "successor-token");
    const released = await releaseRenewableLease(redis as never, "lock", first.token);
    expect(released).toBe(false);
    expect(redis._store.get("lock")).toBe("successor-token");
  });

  it("renew extends only while token matches", async () => {
    const redis = mockRedis();
    const lease = await acquireRenewableLease(redis as never, "lock", 500);
    expect(lease).not.toBeNull();
    if (!lease) return;
    expect(await renewRenewableLease(redis as never, "lock", lease.token, 500)).toBe(true);
    expect(await renewRenewableLease(redis as never, "lock", "wrong", 500)).toBe(false);
  });
});
