import { afterEach, describe, expect, it, vi } from "vitest";
import { isStrictBidEligibilityEnabled } from "./strict-bid-eligibility-rollout.server";

describe("isStrictBidEligibilityEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the explicit rollout value", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("STRICT_BID_ELIGIBILITY_ENABLED", "true");
    expect(isStrictBidEligibilityEnabled()).toBe(true);

    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("STRICT_BID_ELIGIBILITY_ENABLED", "off");
    expect(isStrictBidEligibilityEnabled()).toBe(false);
  });

  it("defaults off in production and on outside production using APP_ENV", () => {
    vi.stubEnv("STRICT_BID_ELIGIBILITY_ENABLED", "");
    vi.stubEnv("APP_ENV", "production");
    expect(isStrictBidEligibilityEnabled()).toBe(false);

    vi.stubEnv("APP_ENV", "test");
    expect(isStrictBidEligibilityEnabled()).toBe(true);
  });
});
