import { describe, expect, it } from "vitest";
import { InMemoryCircuitBreaker } from "./inmemory-circuit-breaker.js";

describe("InMemoryCircuitBreaker", () => {
  it("opens after repeated recordFailure calls", () => {
    const breaker = new InMemoryCircuitBreaker();
    const key = "meta_capi";
    for (let i = 0; i < 5; i++) {
      breaker.recordFailure(key);
    }
    expect(breaker.isOpen(key)).toBe(true);
  });

  it("clears failures after successful run", async () => {
    const breaker = new InMemoryCircuitBreaker();
    const key = "meta_capi";
    for (let i = 0; i < 4; i++) {
      breaker.recordFailure(key);
    }
    await breaker.run(key, async () => "ok");
    for (let i = 0; i < 4; i++) {
      breaker.recordFailure(key);
    }
    expect(breaker.isOpen(key)).toBe(false);
  });

  it("throws when circuit is open", async () => {
    const breaker = new InMemoryCircuitBreaker();
    const key = "sgtm";
    for (let i = 0; i < 5; i++) {
      breaker.recordFailure(key);
    }
    await expect(breaker.run(key, async () => "x")).rejects.toThrow(/circuit_open/);
  });
});
