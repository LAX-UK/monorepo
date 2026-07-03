import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type {
  IOnboardingProfileService,
  IOnboardingReadService,
  IOnboardingStepService,
  IOnboardingSubmitService,
  IOrganizationOnboardingFlowService,
} from "./onboarding-context.js";
import type { OrganizationOnboardingFlowService } from "./organization-onboarding-flow.service.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: OrganizationOnboardingFlowService;

type _Composite = AssertAssignable<typeof facade, IOrganizationOnboardingFlowService>;
type _Read = AssertAssignable<typeof facade, IOnboardingReadService>;
type _Profile = AssertAssignable<typeof facade, IOnboardingProfileService>;
type _Step = AssertAssignable<typeof facade, IOnboardingStepService>;
type _Submit = AssertAssignable<typeof facade, IOnboardingSubmitService>;

type _FacadeContract = [_Composite, _Read, _Profile, _Step, _Submit];

defineCompileTimeContract<_FacadeContract>();

describe("OrganizationOnboardingFlowService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
