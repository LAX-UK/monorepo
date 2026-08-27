import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackBuyerPersonalization, trackKycOnboarding } from "./events";

vi.mock("./is-enabled", () => ({
  isAnalyticsEnabled: () => true,
}));

vi.mock("./consent-headers", () => ({
  readConsentFromDocument: () => ({ analytics: true, marketing: true }),
}));

describe("KYC and buyer onboarding analytics", () => {
  beforeEach(() => {
    window.dataLayer = [];
  });

  afterEach(() => {
    window.dataLayer = [];
  });

  it("records KYC events with source and step and never includes PII", () => {
    const eventId = trackKycOnboarding({
      event: "kyc_onboarding_skip",
      step: "why",
      source: "post_verify",
    });

    expect(eventId).toEqual(expect.any(String));
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer?.[0]).toEqual({
      event: "kyc_onboarding_skip",
      event_id: eventId,
      onboarding_step: "why",
      onboarding_source: "post_verify",
    });
    expect(JSON.stringify(window.dataLayer)).not.toMatch(/@|email|phone|veriff/i);
  });

  it("records personalization events with source and selection count only", () => {
    const eventId = trackBuyerPersonalization({
      event: "buyer_interests_completed",
      source: "sign_in_resume",
      selectedCount: 2,
    });

    expect(window.dataLayer?.[0]).toEqual({
      event: "buyer_interests_completed",
      event_id: eventId,
      onboarding_source: "sign_in_resume",
      interest_selection_count: 2,
    });
    expect(JSON.stringify(window.dataLayer)).not.toMatch(/@|email|category-/i);
  });
});
