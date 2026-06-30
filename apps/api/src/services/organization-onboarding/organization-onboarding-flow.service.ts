import type { Database } from "@auction/db";
import type { OrgOnboardingStepKey } from "@auction/types";
import type { LegalEntityDocumentUploadInput } from "@auction/validators";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { IOrganizationOnboardingService } from "../interfaces/organization-onboarding.js";
import type { IConnectAccountSync, IConnectSessionProvider } from "../interfaces/stripe-connect.js";
import { attachDocument, detachDocument } from "./org-onboarding-documents.js";
import type {
  OrganizationOnboardingFlowOptions,
  OrganizationOnboardingGetResult,
  OrganizationOnboardingProfileInput,
  SubmitForReviewResult,
} from "./org-onboarding-mappers.js";
import {
  completeDetailsWithType,
  completeStep,
  getOnboarding,
  submitForReview,
  updateProfile,
} from "./org-onboarding-progress.js";
import type { OrganizationOnboardingFlowDeps } from "./org-onboarding-types.js";

export type {
  OrganizationOnboardingDocumentDto,
  OrganizationOnboardingFlowOptions,
  OrganizationOnboardingGetResult,
  OrganizationOnboardingProfileInput,
  SubmitForReviewResult,
} from "./org-onboarding-mappers.js";

export class OrganizationOnboardingFlowService {
  private readonly deps: OrganizationOnboardingFlowDeps;

  constructor(
    db: Database,
    legalEntityRepository: ILegalEntityRepository,
    organizationOnboardingService: IOrganizationOnboardingService,
    domainEventPublisher: DomainEventPublisher,
    stripeConnect:
      | (IConnectAccountSync & Pick<IConnectSessionProvider, "isConfigured">)
      | null = null,
    options: OrganizationOnboardingFlowOptions = {},
  ) {
    this.deps = {
      db,
      legalEntityRepository,
      organizationOnboardingService,
      domainEventPublisher,
      stripeConnect,
      options,
    };
  }

  getOnboarding(userId: string, entityId: string): Promise<OrganizationOnboardingGetResult | null> {
    return getOnboarding(this.deps, userId, entityId);
  }

  updateProfile(
    userId: string,
    entityId: string,
    input: OrganizationOnboardingProfileInput,
  ): Promise<
    { ok: true } | { ok: false; code: "not_found" | "forbidden" | "entity_not_editable" }
  > {
    return updateProfile(this.deps, userId, entityId, input);
  }

  attachDocument(
    userId: string,
    entityId: string,
    input: LegalEntityDocumentUploadInput,
  ): ReturnType<typeof attachDocument> {
    return attachDocument(this.deps, userId, entityId, input);
  }

  detachDocument(
    userId: string,
    entityId: string,
    documentId: string,
  ): ReturnType<typeof detachDocument> {
    return detachDocument(this.deps, userId, entityId, documentId);
  }

  completeStep(
    userId: string,
    entityId: string,
    step: OrgOnboardingStepKey,
  ): ReturnType<typeof completeStep> {
    return completeStep(this.deps, userId, entityId, step);
  }

  completeDetailsWithType(
    userId: string,
    entityId: string,
  ): ReturnType<typeof completeDetailsWithType> {
    return completeDetailsWithType(this.deps, userId, entityId);
  }

  submitForReview(userId: string, entityId: string): Promise<SubmitForReviewResult> {
    return submitForReview(this.deps, userId, entityId);
  }
}
