import { describe, expect, it } from "vitest";
import {
  decideAuthorizeTwoFactorStep,
  resolveTwoFactorRequirement,
} from "./two-factor-requirement.js";

const ORG_A = "00000000-0000-4000-8000-00000000000a";
const ORG_B = "00000000-0000-4000-8000-00000000000b";

describe("resolveTwoFactorRequirement", () => {
  it("does not require two-step verification for a subject without staff or org access", () => {
    expect(
      resolveTwoFactorRequirement({ markers: [], policies: [{ scope: "staff", required: true }] }),
    ).toEqual({ required: false, sources: [] });
  });

  it("follows the staff policy for staff on any platform", () => {
    const markers = [{ kind: "staff", product: "shop" }] as const;
    expect(
      resolveTwoFactorRequirement({ markers, policies: [{ scope: "staff", required: true }] }),
    ).toEqual({ required: true, sources: [{ scope: "staff" }] });
    expect(
      resolveTwoFactorRequirement({ markers, policies: [{ scope: "staff", required: false }] }),
    ).toEqual({ required: false, sources: [] });
  });

  it("requires staff two-step verification when no staff policy row exists", () => {
    expect(
      resolveTwoFactorRequirement({ markers: [{ kind: "staff", product: "bid" }], policies: [] }),
    ).toEqual({ required: true, sources: [{ scope: "staff" }] });
  });

  it("applies only the policies of organisations the subject belongs to", () => {
    expect(
      resolveTwoFactorRequirement({
        markers: [
          { kind: "org_member", legalEntityId: ORG_A },
          { kind: "org_member", legalEntityId: ORG_B },
        ],
        policies: [
          { scope: "org", legalEntityId: ORG_A, required: true },
          { scope: "org", legalEntityId: ORG_B, required: false },
          { scope: "org", legalEntityId: "00000000-0000-4000-8000-00000000000c", required: true },
        ],
      }),
    ).toEqual({ required: true, sources: [{ scope: "org", legalEntityId: ORG_A }] });
  });

  it("lists staff and organisation sources together", () => {
    expect(
      resolveTwoFactorRequirement({
        markers: [
          { kind: "staff", product: "bid" },
          { kind: "staff", product: "shop" },
          { kind: "org_member", legalEntityId: ORG_A },
        ],
        policies: [
          { scope: "staff", required: true },
          { scope: "org", legalEntityId: ORG_A, required: true },
        ],
      }).sources,
    ).toEqual([{ scope: "staff" }, { scope: "org", legalEntityId: ORG_A }]);
  });
});

describe("decideAuthorizeTwoFactorStep", () => {
  const base = {
    requestsSilver: false,
    requiredByPolicy: false,
    mfaCompletedAt: null,
    socialAuthAt: null,
    twoFactorEnabled: false,
    canEnrolTotp: true,
  };

  it("passes optional two-step verification without a challenge", () => {
    expect(decideAuthorizeTwoFactorStep(base)).toBe("pass");
    expect(decideAuthorizeTwoFactorStep({ ...base, twoFactorEnabled: true })).toBe("pass");
  });

  it("forces enrolment or verification when policy requires it", () => {
    expect(decideAuthorizeTwoFactorStep({ ...base, requiredByPolicy: true })).toBe("setup");
    expect(
      decideAuthorizeTwoFactorStep({ ...base, requiredByPolicy: true, twoFactorEnabled: true }),
    ).toBe("verify");
  });

  it("accepts a social sign-in for a policy requirement", () => {
    expect(
      decideAuthorizeTwoFactorStep({
        ...base,
        requiredByPolicy: true,
        canEnrolTotp: false,
        socialAuthAt: new Date(),
      }),
    ).toBe("pass");
  });

  it("keeps Silver requests strict even after a social sign-in", () => {
    expect(
      decideAuthorizeTwoFactorStep({
        ...base,
        requestsSilver: true,
        canEnrolTotp: false,
        socialAuthAt: new Date(),
      }),
    ).toBe("unmet");
  });

  it("passes once the session completed two-step verification", () => {
    expect(
      decideAuthorizeTwoFactorStep({
        ...base,
        requestsSilver: true,
        requiredByPolicy: true,
        mfaCompletedAt: new Date(),
      }),
    ).toBe("pass");
  });
});
