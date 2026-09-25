import { describe, expect, it } from "vitest";
import { accountOnboardingBodySchema, isAccountOnboardingComplete } from "./account-onboarding.js";

describe("accountOnboardingBodySchema", () => {
  it("outputs submit body without acceptTerms or turnstile", () => {
    const parsed = accountOnboardingBodySchema.parse({
      firstName: " Ada ",
      lastName: " Lovelace ",
      persona: "individual",
      acceptTerms: true,
      turnstileToken: "ignored",
    });
    expect(parsed).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      persona: "individual",
    });
  });
});

describe("isAccountOnboardingComplete", () => {
  it("requires terms timestamp (persona optional for legacy users)", () => {
    expect(isAccountOnboardingComplete({ termsAcceptedAt: new Date() })).toBe(true);
    expect(isAccountOnboardingComplete({ termsAcceptedAt: null })).toBe(false);
  });
});
