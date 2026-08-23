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
  emailStatus: "ok" as const,
  twoFactorEnabled: true,
};

describe("ComplianceStatusStrip identity pill", () => {
  it.each([
    ["Not verified", {}],
    [
      "Started",
      {
        status: "pending" as const,
        latestSessionStatus: "created" as const,
        feedback: {
          headline: "Verification started",
          detail: "Complete checks",
          action: "continue" as const,
          reasonCode: null,
          decisionStatus: null,
          needsResubmit: false,
        },
      },
    ],
    [
      "In review",
      {
        status: "pending" as const,
        latestSessionStatus: "processing" as const,
        feedback: {
          headline: "In review",
          detail: null,
          action: "wait" as const,
          reasonCode: null,
          decisionStatus: "review",
          needsResubmit: false,
        },
      },
    ],
    [
      "Action needed",
      {
        status: "pending" as const,
        latestSessionStatus: "requires_input" as const,
        feedback: {
          headline: "More information needed",
          detail: "Complete the missing checks",
          action: "continue" as const,
          reasonCode: null,
          decisionStatus: null,
          needsResubmit: true,
        },
      },
    ],
    [
      "Rejected",
      {
        status: "rejected" as const,
        feedback: {
          headline: "Verification rejected",
          detail: "Please try again",
          action: "retry" as const,
          reasonCode: null,
          decisionStatus: "declined",
          needsResubmit: false,
        },
      },
    ],
    ["Required", { requiresKyc: true }],
  ])("shows the unresolved identity state %s", (value, overrides) => {
    render(
      <ComplianceStatusStrip user={baseUser} addressesCount={1} kyc={kycSummary(overrides)} />,
    );

    expect(screen.getByText(value)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(`Identity: ${value}`) })).toHaveAttribute(
      "href",
      expect.stringContaining("/onboarding/identity"),
    );
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
    expect(screen.queryByText("Address")).not.toBeInTheDocument();
    expect(screen.queryByText("2FA")).not.toBeInTheDocument();
  });

  it("omits every completed check and the strip itself", () => {
    const { container } = render(
      <ComplianceStatusStrip
        user={baseUser}
        addressesCount={2}
        kyc={kycSummary({
          status: "approved",
          verifiedAt: "2026-08-20T00:00:00.000Z",
          feedback: {
            headline: "Verified",
            detail: null,
            action: "none",
            reasonCode: null,
            decisionStatus: "approved",
            needsResubmit: false,
          },
        })}
        payoutSetup={{ ready: true, href: "/dashboard/seller/payouts" }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("navigation", { name: "Account readiness" })).not.toBeInTheDocument();
  });

  it("shows only incomplete email, address, 2FA, and payout actions", () => {
    render(
      <ComplianceStatusStrip
        user={{ ...baseUser, emailVerified: false, twoFactorEnabled: false }}
        addressesCount={0}
        kyc={kycSummary({
          status: "approved",
          verifiedAt: "2026-08-20T00:00:00.000Z",
        })}
        payoutSetup={{ ready: false, href: "/dashboard/seller/connect" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Email: Unverified" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Address: Add address" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /2FA: Off/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Payouts: Setup needed/ })).toBeInTheDocument();
    expect(screen.queryByText("Identity")).not.toBeInTheDocument();
  });
});
