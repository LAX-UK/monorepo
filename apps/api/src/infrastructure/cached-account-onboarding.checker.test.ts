import { describe, expect, it, vi } from "vitest";
import { CachedAccountOnboardingChecker } from "./cached-account-onboarding.checker.js";

describe("CachedAccountOnboardingChecker", () => {
  it("caches complete status per user", async () => {
    const getStatus = vi.fn(async () => ({ complete: true }));
    const cache = {
      get: vi
        .fn<(key: string) => Promise<string | null>>()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("1"),
      set: vi.fn(async () => undefined),
      del: vi.fn(async () => undefined),
    };
    const checker = new CachedAccountOnboardingChecker({ getStatus } as never, cache as never);

    await expect(checker.isComplete("u1")).resolves.toBe(true);
    await expect(checker.isComplete("u1")).resolves.toBe(true);

    expect(getStatus).toHaveBeenCalledOnce();
    expect(cache.set).toHaveBeenCalledOnce();
  });

  it("invalidates cached status", async () => {
    const cache = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(async () => undefined),
    };
    const checker = new CachedAccountOnboardingChecker(
      { getStatus: vi.fn() } as never,
      cache as never,
    );

    await checker.invalidate("u1");
    expect(cache.del).toHaveBeenCalledWith("user:u1:onboarding_complete");
  });
});
