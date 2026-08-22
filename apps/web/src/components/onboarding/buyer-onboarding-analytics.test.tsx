import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuyerRecommendationsEmptyRedirect } from "./buyer-onboarding-analytics";

const replace = vi.fn();
const trackBuyerPersonalization = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/onboarding/recommendations",
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/analytics/events", () => ({
  trackBuyerPersonalization: (...args: unknown[]) => trackBuyerPersonalization(...args),
  trackContextualKycGate: vi.fn(),
  trackKycOnboarding: vi.fn(),
}));

describe("BuyerRecommendationsEmptyRedirect", () => {
  beforeEach(() => {
    replace.mockReset();
    trackBuyerPersonalization.mockReset();
  });

  it("records the empty result exactly once before redirecting", async () => {
    const { rerender } = render(
      <BuyerRecommendationsEmptyRedirect source="post_verify" href="/onboarding/identity" />,
    );
    rerender(
      <BuyerRecommendationsEmptyRedirect source="post_verify" href="/onboarding/identity" />,
    );

    await waitFor(() => {
      expect(trackBuyerPersonalization).toHaveBeenCalledTimes(1);
      expect(trackBuyerPersonalization).toHaveBeenCalledWith({
        event: "buyer_recommendations_empty",
        source: "post_verify",
      });
      expect(replace).toHaveBeenCalledWith("/onboarding/identity");
    });
  });
});
