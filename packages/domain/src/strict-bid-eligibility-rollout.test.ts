import { describe, expect, it } from "vitest";
import { resolveStrictBidEligibilityRollout } from "./strict-bid-eligibility-rollout.js";

describe("resolveStrictBidEligibilityRollout", () => {
  it("keeps production opt-in", () => {
    expect(resolveStrictBidEligibilityRollout({ appEnv: "production" })).toBe(false);
  });

  it("exercises strict eligibility outside production by default", () => {
    expect(resolveStrictBidEligibilityRollout({ appEnv: "development" })).toBe(true);
    expect(resolveStrictBidEligibilityRollout({ appEnv: "test" })).toBe(true);
  });

  it("honours an explicit deployment value", () => {
    expect(resolveStrictBidEligibilityRollout({ appEnv: "production", enabled: true })).toBe(true);
    expect(resolveStrictBidEligibilityRollout({ appEnv: "test", enabled: false })).toBe(false);
  });
});
