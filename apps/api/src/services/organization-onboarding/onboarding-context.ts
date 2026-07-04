import type { IUploadPersistenceRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityOnboardingRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { OrgOnboardingStepKey } from "@auction/types";
import type { LegalEntityDocumentUploadInput } from "@auction/validators";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IOrganizationOnboardingService } from "../interfaces/organization-onboarding.js";
import type { IConnectAccountSync, IConnectSessionProvider } from "../interfaces/stripe-connect.js";
import type {
  OrganizationOnboardingFlowOptions,
  OrganizationOnboardingGetResult,
  OrganizationOnboardingProfileInput,
  SubmitForReviewResult,
} from "./org-onboarding-mappers.js";

export type OnboardingContext = {
  transactionRunner: import("@auction/persistence/interfaces").ITransactionRunner;
  onboardingRepo: ILegalEntityOnboardingRepository;
  uploadPersistenceRepository: IUploadPersistenceRepository;
  legalEntityRepository: ILegalEntityRepository;
  organizationOnboardingService: IOrganizationOnboardingService;
  domainEventSink: IDomainEventSink;
  stripeConnect: (IConnectAccountSync & Pick<IConnectSessionProvider, "isConfigured">) | null;
  options: OrganizationOnboardingFlowOptions;
};

export function createOnboardingContext(input: {
  transactionRunner: import("@auction/persistence/interfaces").ITransactionRunner;
  onboardingRepo: ILegalEntityOnboardingRepository;
  uploadPersistenceRepository: IUploadPersistenceRepository;
  legalEntityRepository: ILegalEntityRepository;
  organizationOnboardingService: IOrganizationOnboardingService;
  domainEventSink: IDomainEventSink;
  stripeConnect: (IConnectAccountSync & Pick<IConnectSessionProvider, "isConfigured">) | null;
  options?: OrganizationOnboardingFlowOptions;
}): OnboardingContext {
  return {
    ...input,
    options: input.options ?? {},
  };
}

export interface IOnboardingReadService {
  getOnboarding(userId: string, entityId: string): Promise<OrganizationOnboardingGetResult | null>;
}

export interface IOnboardingProfileService {
  updateProfile(
    userId: string,
    entityId: string,
    input: OrganizationOnboardingProfileInput,
  ): Promise<{ ok: true } | { ok: false; code: "not_found" | "forbidden" | "entity_not_editable" }>;
}

export type OnboardingStepCompleteResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "not_found"
        | "forbidden"
        | "documents_incomplete"
        | "connect_not_started"
        | "connect_not_complete"
        | "connect_sync_failed"
        | "connect_requirements_pending"
        | "connect_restricted"
        | "type_incomplete"
        | "address_required"
        | "vat_required";
    };

export interface IOnboardingStepService {
  completeStep(
    userId: string,
    entityId: string,
    step: OrgOnboardingStepKey,
  ): Promise<OnboardingStepCompleteResult>;

  completeDetailsWithType(userId: string, entityId: string): Promise<OnboardingStepCompleteResult>;
}

export interface IOnboardingSubmitService {
  submitForReview(userId: string, entityId: string): Promise<SubmitForReviewResult>;
}

export interface IOrganizationOnboardingFlowService
  extends IOnboardingReadService,
    IOnboardingProfileService,
    IOnboardingStepService,
    IOnboardingSubmitService {
  attachDocument(
    userId: string,
    entityId: string,
    input: LegalEntityDocumentUploadInput,
  ): Promise<
    | { ok: true; id: string }
    | {
        ok: false;
        code:
          | "forbidden"
          | "upload_not_found"
          | "upload_not_ready"
          | "upload_kind_mismatch"
          | "duplicate_upload"
          | "other_document_label_required"
          | "entity_not_editable"
          | "not_found";
      }
  >;

  detachDocument(
    userId: string,
    entityId: string,
    documentId: string,
  ): Promise<
    | { ok: true }
    | { ok: false; code: "forbidden" | "not_found" | "document_not_found" | "entity_not_editable" }
  >;
}
