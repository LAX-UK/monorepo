import { afterEach, describe, expect, it, vi } from "vitest";
import { isStrictBidEligibilityEnabled } from "./strict-bid-eligibility-rollout.server";

describe("isStrictBidEligibilityEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the explicit rollout value", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRICT_BID_ELIGIBILITY_ENABLED", "true");
    expect(isStrictBidEligibilityEnabled()).toBe(true);

    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("STRICT_BID_ELIGIBILITY_ENABLED", "off");
    expect(isStrictBidEligibilityEnabled()).toBe(false);
  });

  it("defaults off in production and on outside production", () => {
    vi.stubEnv("STRICT_BID_ELIGIBILITY_ENABLED", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(isStrictBidEligibilityEnabled()).toBe(false);

    vi.stubEnv("NODE_ENV", "test");
    expect(isStrictBidEligibilityEnabled()).toBe(true);
  });
});
