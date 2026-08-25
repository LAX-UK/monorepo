import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BuyerInterestsViewTracker,
  BuyerRecommendationsViewTracker,
  IdentityOnboardingViewTracker,
} from "./buyer-onboarding-analytics";

const trackBuyerPersonalization = vi.fn();
const trackKycOnboarding = vi.fn();

vi.mock("@/lib/analytics/events", () => ({
  trackBuyerPersonalization: (...args: unknown[]) => trackBuyerPersonalization(...args),
  trackKycOnboarding: (...args: unknown[]) => trackKycOnboarding(...args),
  trackContextualKycGate: vi.fn(),
}));

describe("buyer onboarding view trackers", () => {
  beforeEach(() => {
    trackBuyerPersonalization.mockReset();
    trackKycOnboarding.mockReset();
  });

  it("fires interests viewed once per mount", () => {
    const { rerender } = render(<BuyerInterestsViewTracker source="post_verify" />);
    rerender(<BuyerInterestsViewTracker source="post_verify" />);
    expect(trackBuyerPersonalization).toHaveBeenCalledTimes(1);
    expect(trackBuyerPersonalization).toHaveBeenCalledWith({
      event: "buyer_interests_viewed",
      source: "post_verify",
    });
  });

  it("fires the empty recommendations event when the page has no lots", () => {
    render(<BuyerRecommendationsViewTracker source="sign_in_resume" empty />);
    expect(trackBuyerPersonalization).toHaveBeenCalledWith({
      event: "buyer_recommendations_empty",
      source: "sign_in_resume",
    });
  });

  it("fires identity viewed once with the preserved source", () => {
    const { rerender } = render(<IdentityOnboardingViewTracker source="bid_gate" step="why" />);
    rerender(<IdentityOnboardingViewTracker source="bid_gate" step="why" />);
    expect(trackKycOnboarding).toHaveBeenCalledTimes(1);
    expect(trackKycOnboarding).toHaveBeenCalledWith({
      event: "kyc_onboarding_view",
      step: "why",
      source: "bid_gate",
    });
  });
});
