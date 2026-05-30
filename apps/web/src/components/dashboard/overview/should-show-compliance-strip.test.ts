import { shouldShowComplianceStrip } from "@/components/dashboard/overview/should-show-compliance-strip";
import { describe, expect, it } from "vitest";

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
});
