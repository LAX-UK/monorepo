import { describe, expect, it, vi } from "vitest";
import { MachineCredentialRateLimiter } from "./machine-credential-rate-limiter.js";

function setup(initial = 0) {
  let count = initial;
  const redis = {
    get: vi.fn(async () => (count > 0 ? String(count) : null)),
    incr: vi.fn(async () => {
      count += 1;
      return count;
    }),
    expire: vi.fn(async () => 1),
    ttl: vi.fn(async () => 37),
    del: vi.fn(async () => {
      count = 0;
      return 1;
    }),
  };
  return { limiter: new MachineCredentialRateLimiter(redis), redis };
}

describe("machine credential failure limiter", () => {
  it("allows the configured failure budget and locks the next attempt", async () => {
    const { limiter } = setup();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(limiter.recordFailure("auth-service")).resolves.toEqual({ limited: false });
    }
    await expect(limiter.check("auth-service")).resolves.toEqual({
      limited: true,
      retryAfterSec: 37,
    });
  });

  it("sets the failure window only for the first failure", async () => {
    const { limiter, redis } = setup();
    await limiter.recordFailure("auth-service");
    await limiter.recordFailure("auth-service");
    expect(redis.expire).toHaveBeenCalledTimes(1);
    expect(redis.expire).toHaveBeenCalledWith(expect.any(String), 60);
  });

  it("resets the client bucket after successful authentication", async () => {
    const { limiter } = setup(10);
    await limiter.reset("auth-service");
    await expect(limiter.check("auth-service")).resolves.toEqual({ limited: false });
  });

  it("hashes client ids before using them in Redis keys", async () => {
    const { limiter, redis } = setup();
    await limiter.recordFailure("client:id/with unsafe text");
    expect(redis.incr).toHaveBeenCalledWith(
      expect.stringMatching(/^rl:auth-issuer:machine-credential:[0-9a-f]{64}$/),
    );
  });
});
