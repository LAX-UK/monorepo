import { afterEach, describe, expect, it, vi } from "vitest";
import { isFullBuyerOnboardingEnabled } from "./full-buyer-onboarding-rollout.server";
import { isIdentityOnboardingEnabled } from "./identity-onboarding-rollout.server";

describe.each([
  ["KYC_ONBOARDING_ENABLED", isIdentityOnboardingEnabled],
  ["FULL_BUYER_ONBOARDING_ENABLED", isFullBuyerOnboardingEnabled],
] as const)("%s rollout", (flag, isEnabled) => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults on for test deployments built with NODE_ENV=production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv(flag, "");
    expect(isEnabled()).toBe(true);
  });

  it("defaults off in production, including when APP_ENV is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(flag, "");
    vi.stubEnv("APP_ENV", "production");
    expect(isEnabled()).toBe(false);
    vi.stubEnv("APP_ENV", undefined);
    expect(isEnabled()).toBe(false);
  });

  it("honours an explicit value over the environment default", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv(flag, "false");
    expect(isEnabled()).toBe(false);
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv(flag, "true");
    expect(isEnabled()).toBe(true);
  });
});
