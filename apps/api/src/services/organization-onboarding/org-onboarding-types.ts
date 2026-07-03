import type { IUploadPersistenceRepository } from "@auction/persistence";
import type { ILegalEntityOnboardingRepository } from "../../repositories/interfaces/legal-entity-onboarding.repository.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { IOrganizationOnboardingService } from "../interfaces/organization-onboarding.js";
import type { IConnectAccountSync, IConnectSessionProvider } from "../interfaces/stripe-connect.js";
import type { OrganizationOnboardingFlowOptions } from "./org-onboarding-mappers.js";

/** Resolved deps record built once in OrganizationOnboardingFlowService constructor. */
export type OrganizationOnboardingFlowDeps = {
  legalEntityRepository: ILegalEntityRepository;
  onboardingRepo: ILegalEntityOnboardingRepository;
  uploadPersistenceRepository: IUploadPersistenceRepository;
  organizationOnboardingService: IOrganizationOnboardingService;
  domainEventPublisher: DomainEventPublisher;
  stripeConnect: (IConnectAccountSync & Pick<IConnectSessionProvider, "isConfigured">) | null;
  options: OrganizationOnboardingFlowOptions;
};
