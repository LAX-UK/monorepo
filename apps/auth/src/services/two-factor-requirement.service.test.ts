import { decideAuthorizeTwoFactorStep } from "@auction/auth";
import { describe, expect, it } from "vitest";
import { createTwoFactorRequirementReader } from "./two-factor-requirement.service.js";

const ORG = "00000000-0000-4000-8000-00000000000a";

const orgRequiresTwoStep = createTwoFactorRequirementReader({
  readSubjectPolicyInputs: async () => ({
    markers: [{ kind: "org_member", legalEntityId: ORG }],
    policies: [{ scope: "org", legalEntityId: ORG, required: true }],
  }),
});

describe("two-factor requirement for an organisation member", () => {
  it("is required by the organisation's policy, with the organisation as its source", async () => {
    await expect(orgRequiresTwoStep("person")).resolves.toEqual({
      required: true,
      sources: [{ scope: "org", legalEntityId: ORG }],
    });
  });

  it("sends a member who has not enrolled to setup, not to a code challenge or through", async () => {
    // Signed in with a password after a social-only reset: no second step done, none enrolled.
    const requirement = await orgRequiresTwoStep("person");
    expect(
      decideAuthorizeTwoFactorStep({
        requestsSilver: false,
        requiredByPolicy: requirement.required,
        mfaCompletedAt: null,
        twoFactorEnabled: false,
        canEnrolTotp: true,
      }),
    ).toBe("setup");
  });

  it("asks an enrolled member for the code instead", async () => {
    const requirement = await orgRequiresTwoStep("person");
    expect(
      decideAuthorizeTwoFactorStep({
        requestsSilver: false,
        requiredByPolicy: requirement.required,
        mfaCompletedAt: null,
        twoFactorEnabled: true,
        canEnrolTotp: true,
      }),
    ).toBe("verify");
  });
});
