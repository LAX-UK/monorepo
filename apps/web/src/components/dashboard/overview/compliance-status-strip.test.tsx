import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { laxAccountUrl } from "@/lib/lax-account-url";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComplianceStatusStrip } from "./compliance-status-strip";

function kycSummary(overrides: Partial<KycStatusSummaryDto> = {}): KycStatusSummaryDto {
  return {
    status: "unverified",
    verifiedAt: null,
    latestSessionId: null,
    latestSessionStatus: null,
    feedback: {
      headline: "Not verified",
      detail: null,
      action: "start",
      reasonCode: null,
      decisionStatus: null,
      needsResubmit: false,
    },
    pendingExposure: { total: 0, currency: "GBP" },
    thresholdAmount: 1000,
    thresholdCurrency: "GBP",
    requiresKyc: false,
    ...overrides,
  };
}

const baseUser = {
  emailVerified: true as const,
  emailStatus: "ok" as const,
  kycStatus: "unverified" as const,
};

describe("ComplianceStatusStrip identity pill", () => {
  it("shows Started for pending user with created session", () => {
    render(
      <ComplianceStatusStrip
        user={baseUser}
        addressesCount={1}
        kyc={kycSummary({
          status: "pending",
          latestSessionStatus: "created",
          feedback: {
            headline: "Verification started",
            detail: "Complete checks",
            action: "continue",
            reasonCode: null,
            decisionStatus: null,
            needsResubmit: false,
          },
        })}
      />,
    );
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.queryByText("In review")).not.toBeInTheDocument();
  });

  it("shows In review for submitted session", () => {
    render(
      <ComplianceStatusStrip
        user={baseUser}
        addressesCount={1}
        kyc={kycSummary({
          status: "pending",
          latestSessionStatus: "processing",
          feedback: {
            headline: "In review",
            detail: null,
            action: "wait",
            reasonCode: null,
            decisionStatus: "review",
            needsResubmit: false,
          },
        })}
      />,
    );
    expect(screen.getByText("In review")).toBeInTheDocument();
  });
});

describe("ComplianceStatusStrip", () => {
  it("renders nothing when there is nothing left to fix", () => {
    const { container } = render(
      <ComplianceStatusStrip
        user={{ ...baseUser, kycStatus: "approved" }}
        addressesCount={2}
        kyc={kycSummary({ status: "approved" })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists only what blocks a payment, with no two-step pill", () => {
    render(
      <ComplianceStatusStrip
        user={{ ...baseUser, emailVerified: false as never }}
        addressesCount={0}
        kyc={kycSummary({ status: "approved" })}
      />,
    );
    expect(screen.getByText("Add address")).toBeInTheDocument();
    expect(screen.getByText("Unverified")).toBeInTheDocument();
    expect(screen.queryByText("2FA")).not.toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  it("sends address and email problems to LAX Account", () => {
    render(<ComplianceStatusStrip user={baseUser} addressesCount={0} kyc={null} />);
    expect(screen.getByRole("link", { name: /address/i })).toHaveAttribute(
      "href",
      laxAccountUrl("/account/profile"),
    );
  });
});
