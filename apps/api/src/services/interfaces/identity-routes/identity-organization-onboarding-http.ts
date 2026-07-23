import type { OrgOnboardingStepKey } from "@auction/types";
import type { IdentityHttpJson } from "./identity-route-http.js";

export interface IIdentityOrganizationOnboardingHttpApplicationService {
  getOnboarding(input: { userId: string; entityId: string }): Promise<IdentityHttpJson>;

  updateProfile(input: {
    userId: string;
    entityId: string;
    body: Record<string, unknown>;
  }): Promise<IdentityHttpJson>;

  attachDocument(input: {
    userId: string;
    entityId: string;
    body: unknown;
  }): Promise<IdentityHttpJson>;

  detachDocument(input: {
    userId: string;
    entityId: string;
    documentId: string;
  }): Promise<IdentityHttpJson>;

  completeStep(input: {
    userId: string;
    entityId: string;
    stepKey: OrgOnboardingStepKey;
  }): Promise<IdentityHttpJson>;

  submitForReview(input: {
    userId: string;
    entityId: string;
  }): Promise<IdentityHttpJson>;
}
