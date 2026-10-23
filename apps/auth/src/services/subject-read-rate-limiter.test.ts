import { describe, expect, it } from "vitest";
import { createSubjectReadRateLimiter } from "./subject-read-rate-limiter.js";

function fakeRedis() {
  const counts = new Map<string, number>();
  return {
    incr: async (key: string) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    expire: async () => 1,
    ttl: async () => 42,
  };
}

describe("createSubjectReadRateLimiter", () => {
  it("allows up to the budget and then returns the seconds left", async () => {
    const limit = createSubjectReadRateLimiter({
      redis: fakeRedis(),
      keyPrefix: "rl:test",
      windowSec: 60,
      max: 2,
    });
    expect(await limit("a")).toBeNull();
    expect(await limit("a")).toBeNull();
    expect(await limit("a")).toBe(42);
  });

  it("budgets each subject separately", async () => {
    const limit = createSubjectReadRateLimiter({
      redis: fakeRedis(),
      keyPrefix: "rl:test",
      windowSec: 60,
      max: 1,
    });
    expect(await limit("a")).toBeNull();
    expect(await limit("b")).toBeNull();
    expect(await limit("a")).not.toBeNull();
  });

  it("fails open when Redis is unavailable", async () => {
    const limit = createSubjectReadRateLimiter({
      redis: {
        incr: async () => {
          throw new Error("down");
        },
        expire: async () => 1,
        ttl: async () => 1,
      },
      keyPrefix: "rl:test",
      windowSec: 60,
      max: 1,
    });
    expect(await limit("a")).toBeNull();
  });
});
