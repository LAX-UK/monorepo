import { describe, expect, it } from "vitest";
import { decideSilverAcrStep } from "./silver-acr-step.js";

describe("decideSilverAcrStep", () => {
  it("passes when MFA completed", () => {
    expect(
      decideSilverAcrStep({
        mfaCompletedAt: new Date(),
        twoFactorEnabled: false,
        canEnrolTotp: false,
      }),
    ).toBe("pass");
  });

  it("verify when 2FA enabled but not completed this session", () => {
    expect(
      decideSilverAcrStep({
        mfaCompletedAt: null,
        twoFactorEnabled: true,
        canEnrolTotp: true,
      }),
    ).toBe("verify");
  });

  it("setup when user can enrol", () => {
    expect(
      decideSilverAcrStep({
        mfaCompletedAt: null,
        twoFactorEnabled: false,
        canEnrolTotp: true,
      }),
    ).toBe("setup");
  });

  it("unmet when cannot enrol", () => {
    expect(
      decideSilverAcrStep({
        mfaCompletedAt: null,
        twoFactorEnabled: false,
        canEnrolTotp: false,
      }),
    ).toBe("unmet");
  });
});
