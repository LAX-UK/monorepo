import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
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
  emailStatus: "active" as const,
  kycStatus: "unverified" as const,
  twoFactorEnabled: false,
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
