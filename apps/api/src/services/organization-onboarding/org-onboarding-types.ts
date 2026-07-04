import type { IUploadPersistenceRepository } from "@auction/persistence";
import type { ILegalEntityOnboardingRepository } from "@auction/persistence";
import type { ILegalEntityRepository } from "@auction/persistence";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IOrganizationOnboardingService } from "../interfaces/organization-onboarding.js";
import type { IConnectAccountSync, IConnectSessionProvider } from "../interfaces/stripe-connect.js";
import type { OrganizationOnboardingFlowOptions } from "./org-onboarding-mappers.js";

/** Resolved deps record built once in OrganizationOnboardingFlowService constructor. */
export type OrganizationOnboardingFlowDeps = {
  legalEntityRepository: ILegalEntityRepository;
  onboardingRepo: ILegalEntityOnboardingRepository;
  uploadPersistenceRepository: IUploadPersistenceRepository;
  organizationOnboardingService: IOrganizationOnboardingService;
  domainEventSink: IDomainEventSink;
  stripeConnect: (IConnectAccountSync & Pick<IConnectSessionProvider, "isConfigured">) | null;
  options: OrganizationOnboardingFlowOptions;
};
