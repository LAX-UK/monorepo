import { RecommendationsContinueLink } from "@/components/onboarding/recommendations-continue-link";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const trackRecommendationsContinue = vi.fn();

vi.mock("@/components/onboarding/buyer-onboarding-analytics", () => ({
  trackRecommendationsContinue: (...args: unknown[]) => trackRecommendationsContinue(...args),
}));

describe("RecommendationsContinueLink", () => {
  it("tracks continue and links to identity with preserved intent", () => {
    render(
      <RecommendationsContinueLink
        href="/onboarding/identity?next=%2Fdashboard&source=post_verify"
        source="post_verify"
      />,
    );

    const link = screen.getByRole("link", { name: "Continue" });
    expect(link).toHaveAttribute(
      "href",
      "/onboarding/identity?next=%2Fdashboard&source=post_verify",
    );
    fireEvent.click(link);
    expect(trackRecommendationsContinue).toHaveBeenCalledWith("post_verify");
  });
});
