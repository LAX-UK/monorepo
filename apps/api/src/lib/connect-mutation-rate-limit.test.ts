import { describe, expect, it, vi } from "vitest";
import { checkConnectMutationRateLimit } from "./connect-mutation-rate-limit.js";

function mockRedis(counts: Record<string, number>) {
  return {
    incr: vi.fn(async (key: string) => {
      counts[key] = (counts[key] ?? 0) + 1;
      return counts[key];
    }),
    expire: vi.fn(async () => 1),
  };
}

describe("checkConnectMutationRateLimit", () => {
  it("allows requests within the per-entity account limit", async () => {
    const counts: Record<string, number> = {};
    const redis = mockRedis(counts);
    const allowed = await checkConnectMutationRateLimit(redis as never, "account", "le1");
    expect(allowed).toBe(true);
    expect(redis.expire).toHaveBeenCalledWith("rl:connect:account:le1", 60);
  });

  it("blocks when sync limit exceeded", async () => {
    const counts: Record<string, number> = { "rl:connect:sync:le1": 40 };
    const redis = mockRedis(counts);
    const allowed = await checkConnectMutationRateLimit(redis as never, "sync", "le1");
    expect(allowed).toBe(false);
  });
});
