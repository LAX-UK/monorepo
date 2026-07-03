import type { ITransactionRunner } from "@auction/persistence";
import type { IUploadPersistenceRepository } from "@auction/persistence";
import type { OrgOnboardingStepKey } from "@auction/types";
import type { LegalEntityDocumentUploadInput } from "@auction/validators";
import type { ILegalEntityOnboardingRepository } from "../../repositories/interfaces/legal-entity-onboarding.repository.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { IOrganizationOnboardingService } from "../interfaces/organization-onboarding.js";
import type { IConnectAccountSync, IConnectSessionProvider } from "../interfaces/stripe-connect.js";
import {
  type IOrganizationOnboardingFlowService,
  createOnboardingContext,
} from "./onboarding-context.js";
import { OnboardingProfileService } from "./onboarding-profile.service.js";
import { OnboardingReadService } from "./onboarding-read.service.js";
import { OnboardingStepService } from "./onboarding-step.service.js";
import { OnboardingSubmitService } from "./onboarding-submit.service.js";
import { attachDocument, detachDocument } from "./org-onboarding-documents.js";
import type {
  OrganizationOnboardingFlowOptions,
  OrganizationOnboardingGetResult,
  OrganizationOnboardingProfileInput,
  SubmitForReviewResult,
} from "./org-onboarding-mappers.js";
import type { OrganizationOnboardingFlowDeps } from "./org-onboarding-types.js";

export type {
  IOnboardingProfileService,
  IOnboardingReadService,
  IOnboardingStepService,
  IOnboardingSubmitService,
  IOrganizationOnboardingFlowService,
} from "./onboarding-context.js";

export type {
  OrganizationOnboardingDocumentDto,
  OrganizationOnboardingFlowOptions,
  OrganizationOnboardingGetResult,
  OrganizationOnboardingProfileInput,
  SubmitForReviewResult,
} from "./org-onboarding-mappers.js";

export class OrganizationOnboardingFlowService implements IOrganizationOnboardingFlowService {
  private readonly deps: OrganizationOnboardingFlowDeps;
  private readonly read: OnboardingReadService;
  private readonly profile: OnboardingProfileService;
  private readonly step: OnboardingStepService;
  private readonly submit: OnboardingSubmitService;

  constructor(
    transactionRunner: ITransactionRunner,
    legalEntityRepository: ILegalEntityRepository,
    organizationOnboardingService: IOrganizationOnboardingService,
    domainEventPublisher: DomainEventPublisher,
    uploadPersistenceRepository: IUploadPersistenceRepository,
    onboardingRepo: ILegalEntityOnboardingRepository,
    stripeConnect:
      | (IConnectAccountSync & Pick<IConnectSessionProvider, "isConfigured">)
      | null = null,
    options: OrganizationOnboardingFlowOptions = {},
  ) {
    this.deps = {
      legalEntityRepository,
      onboardingRepo,
      uploadPersistenceRepository,
      organizationOnboardingService,
      domainEventPublisher,
      stripeConnect,
      options,
    };

    const ctx = createOnboardingContext({
      transactionRunner,
      onboardingRepo,
      uploadPersistenceRepository,
      legalEntityRepository,
      organizationOnboardingService,
      domainEventPublisher,
      stripeConnect,
      options,
    });

    this.read = new OnboardingReadService(ctx);
    this.profile = new OnboardingProfileService(ctx);
    this.step = new OnboardingStepService(ctx);
    this.submit = new OnboardingSubmitService(ctx);
  }

  getOnboarding(userId: string, entityId: string): Promise<OrganizationOnboardingGetResult | null> {
    return this.read.getOnboarding(userId, entityId);
  }

  updateProfile(
    userId: string,
    entityId: string,
    input: OrganizationOnboardingProfileInput,
  ): Promise<
    { ok: true } | { ok: false; code: "not_found" | "forbidden" | "entity_not_editable" }
  > {
    return this.profile.updateProfile(userId, entityId, input);
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
  ): ReturnType<OnboardingStepService["completeStep"]> {
    return this.step.completeStep(userId, entityId, step);
  }

  completeDetailsWithType(
    userId: string,
    entityId: string,
  ): ReturnType<OnboardingStepService["completeDetailsWithType"]> {
    return this.step.completeDetailsWithType(userId, entityId);
  }

  submitForReview(userId: string, entityId: string): Promise<SubmitForReviewResult> {
    return this.submit.submitForReview(userId, entityId);
  }
}
