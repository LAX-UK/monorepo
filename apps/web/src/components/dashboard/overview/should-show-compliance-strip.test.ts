import {
  shouldShowComplianceStrip,
  shouldShowSellerComplianceStrip,
} from "@/components/dashboard/overview/should-show-compliance-strip";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { describe, expect, it } from "vitest";

function kycSummary(status: KycStatusSummaryDto["status"]): KycStatusSummaryDto {
  return {
    status,
    verifiedAt: status === "approved" ? "2026-08-20T00:00:00.000Z" : null,
    latestSessionId: null,
    latestSessionStatus: null,
    feedback: {
      headline: status === "approved" ? "Verified" : "Not verified",
      detail: null,
      action: status === "approved" ? "none" : "start",
      reasonCode: null,
      decisionStatus: null,
      needsResubmit: false,
    },
    pendingExposure: { total: 0, currency: "GBP" },
    thresholdAmount: 1000,
    thresholdCurrency: "GBP",
    requiresKyc: false,
  };
}

describe("shouldShowComplianceStrip", () => {
  const healthyUser = {
    emailVerified: true,
    emailStatus: "ok" as const,
    kycStatus: "approved" as const,
    twoFactorEnabled: true,
  };

  it("hides when account readiness is complete", () => {
    expect(shouldShowComplianceStrip(healthyUser, null, 1)).toBe(false);
  });

  it("shows when address is missing", () => {
    expect(shouldShowComplianceStrip(healthyUser, null, 0)).toBe(true);
  });

  it("shows when 2FA is off", () => {
    expect(shouldShowComplianceStrip({ ...healthyUser, twoFactorEnabled: false }, null, 1)).toBe(
      true,
    );
  });

  it("shows when email verification or delivery needs attention", () => {
    expect(shouldShowComplianceStrip({ ...healthyUser, emailVerified: false }, null, 1)).toBe(true);
    expect(
      shouldShowComplianceStrip({ ...healthyUser, emailStatus: "bounced" as const }, null, 1),
    ).toBe(true);
    expect(
      shouldShowComplianceStrip({ ...healthyUser, emailStatus: "complained" as const }, null, 1),
    ).toBe(true);
  });

  it("shows unresolved KYC and hides approved KYC", () => {
    expect(shouldShowComplianceStrip(healthyUser, kycSummary("unverified"), 1)).toBe(true);
    expect(shouldShowComplianceStrip(healthyUser, kycSummary("pending"), 1)).toBe(true);
    expect(shouldShowComplianceStrip(healthyUser, kycSummary("rejected"), 1)).toBe(true);
    expect(shouldShowComplianceStrip(healthyUser, kycSummary("approved"), 1)).toBe(false);
  });
});

describe("shouldShowSellerComplianceStrip", () => {
  const healthyUser = {
    emailVerified: true,
    emailStatus: "ok" as const,
    kycStatus: "approved" as const,
    twoFactorEnabled: true,
  };

  it("hides when buyer readiness and payout setup are complete", () => {
    expect(
      shouldShowSellerComplianceStrip(healthyUser, null, 1, {
        ready: true,
        href: "/dashboard/seller/payouts",
      }),
    ).toBe(false);
  });

  it("shows when payout setup is not ready", () => {
    expect(
      shouldShowSellerComplianceStrip(healthyUser, null, 1, {
        ready: false,
        href: "/dashboard/seller/connect",
      }),
    ).toBe(true);
  });

  it("shows when buyer readiness needs attention", () => {
    expect(shouldShowSellerComplianceStrip(healthyUser, null, 0, null)).toBe(true);
  });
});
