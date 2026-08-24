import { afterEach, describe, expect, it, vi } from "vitest";
import { isStrictBidEligibilityEnabled } from "./strict-bid-eligibility-rollout.server";

describe("strict bid eligibility default alignment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("mirrors the API APP_ENV fallback when the flag is unset", () => {
    vi.stubEnv("STRICT_BID_ELIGIBILITY_ENABLED", "");

    vi.stubEnv("APP_ENV", "production");
    expect(isStrictBidEligibilityEnabled()).toBe(false);

    vi.stubEnv("APP_ENV", "test");
    expect(isStrictBidEligibilityEnabled()).toBe(true);
  });
});
