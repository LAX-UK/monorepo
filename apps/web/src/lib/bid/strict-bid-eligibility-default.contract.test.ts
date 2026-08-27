import { parseBooleanFlag } from "@auction/validators";
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

  it("enables the same string tokens as API and worker env parsing", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("STRICT_BID_ELIGIBILITY_ENABLED", "1");
    expect(parseBooleanFlag(process.env.STRICT_BID_ELIGIBILITY_ENABLED)).toBe(true);
    expect(isStrictBidEligibilityEnabled()).toBe(true);
  });
});
