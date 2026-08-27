import { KycVerificationBanner } from "@/components/dashboard/kyc-verification-banner";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const summary = {
  status: "none",
  requiresKyc: false,
  pendingExposure: { total: 0, currency: "GBP" },
  thresholdAmount: 10_000,
  thresholdCurrency: "GBP",
};

describe("KycVerificationBanner", () => {
  it("renders proactive copy and onboarding destination", () => {
    render(<KycVerificationBanner summary={summary as never} proactive />);

    expect(screen.getByText(/verify now for uninterrupted bidding/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start identity setup/i })).toHaveAttribute(
      "href",
      "/onboarding/identity?next=%2Fdashboard&source=dashboard",
    );
  });

  it("routes threshold-required users through onboarding when enabled", () => {
    render(
      <KycVerificationBanner
        summary={
          {
            ...summary,
            requiresKyc: true,
            pendingExposure: { total: 12_000, currency: "GBP" },
          } as never
        }
        onboardingEnabled
      />,
    );

    expect(screen.getByText(/identity verification required/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^verify identity$/i })).toHaveAttribute(
      "href",
      "/onboarding/identity?next=%2Fdashboard&source=dashboard",
    );
  });

  it("keeps the onboarding destination while rollout is disabled via layout redirect", () => {
    render(
      <KycVerificationBanner
        summary={
          {
            ...summary,
            requiresKyc: true,
            pendingExposure: { total: 12_000, currency: "GBP" },
          } as never
        }
      />,
    );

    expect(screen.getByRole("link", { name: /^verify identity$/i })).toHaveAttribute(
      "href",
      "/onboarding/identity?next=%2Fdashboard&source=dashboard",
    );
  });

  it("shows status copy instead of a dead action while Veriff is reviewing", () => {
    render(
      <KycVerificationBanner
        summary={
          {
            ...summary,
            status: "pending",
            latestSessionStatus: "processing",
            feedback: {
              headline: "In review",
              detail: null,
              action: "wait",
              reasonCode: null,
              decisionStatus: null,
              needsResubmit: false,
            },
          } as never
        }
        proactive
      />,
    );

    expect(screen.getByText(/identity verification in review/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view verification status/i })).toHaveAttribute(
      "href",
      "/onboarding/identity?next=%2Fdashboard&source=dashboard",
    );
    expect(screen.queryByText(/verify now for uninterrupted bidding/i)).not.toBeInTheDocument();
  });

  it("renders nothing when neither proactive nor required", () => {
    const { container } = render(<KycVerificationBanner summary={summary as never} />);
    expect(container).toBeEmptyDOMElement();
  });
});
