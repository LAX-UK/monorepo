import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import { RedisOAuthAttributionStore } from "./redis-oauth-attribution.store.js";

describe("RedisOAuthAttributionStore", () => {
  it("stores a short-lived new-user marker without overwriting it", async () => {
    const set = vi.fn().mockResolvedValue("OK");
    const store = new RedisOAuthAttributionStore({ set } as unknown as Redis);
    await store.markNewUser("user-1");
    expect(set).toHaveBeenCalledWith("marketing:new-user:user-1", "1", "EX", 1_800, "NX");
  });

  it("completes the marker only after the provider account is created", async () => {
    const evalFn = vi.fn().mockResolvedValue(1);
    const store = new RedisOAuthAttributionStore({ eval: evalFn } as unknown as Redis);
    await store.completeNewUserAccount("user-1", "google");
    expect(evalFn).toHaveBeenCalledWith(
      expect.stringContaining('ARGV[1] == "google"'),
      2,
      "marketing:new-user:user-1",
      "marketing:oauth-signup:user-1",
      "google",
      1_800,
    );
  });

  it.each(["signup", "login", "ignored"] as const)(
    "atomically resolves a %s outcome",
    async (outcome) => {
      const evalFn = vi.fn().mockResolvedValue(outcome);
      const store = new RedisOAuthAttributionStore({ eval: evalFn } as unknown as Redis);
      await expect(store.resolveOutcome("user-1", "apple")).resolves.toBe(outcome);
      expect(evalFn).toHaveBeenCalledWith(
        expect.stringContaining('return "signup"'),
        2,
        "marketing:oauth-signup:user-1",
        "marketing:oauth-outcome:user-1:apple",
        "apple",
        600,
      );
    },
  );
});
