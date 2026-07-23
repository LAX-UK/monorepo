import type { IAdminDisputeCaseEnrichmentReader } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { IWatchlistScreeningReader } from "@auction/persistence/interfaces";
import type { Env } from "../../env.js";
import type { AmlService } from "../aml/aml.service.js";
import type { AdminComplianceRouteServices } from "../interfaces/admin-routes/admin-compliance-routes.js";
import type { IAdminDomainEventQueryService } from "../interfaces/admin-routes/admin-operations-routes.js";
import type { LegalEntityLifecycleAdminService } from "../legal-entity-lifecycle-admin.service.js";
import type { SourceOfFundsDocumentCollectionService } from "../source-of-funds/source-of-funds-document-collection.service.js";
import type { SourceOfFundsDocumentReviewService } from "../source-of-funds/source-of-funds-document-review.service.js";
import type { SourceOfFundsService } from "../source-of-funds/source-of-funds.service.js";
import { AdminAmlApplicationService } from "./admin-aml-application.service.js";
import { AdminDisputeCaseQueryService } from "./admin-dispute-case-query.service.js";
import { AdminLegalEntityLifecycleApplicationService } from "./admin-legal-entity-lifecycle-application.service.js";
import { AdminSourceOfFundsApplicationService } from "./admin-source-of-funds-application.service.js";
import type { AdminSourceOfFundsQueryService } from "./admin-source-of-funds-query.service.js";
import type { LegalEntityDocumentAdminService } from "./legal-entity-document-admin.service.js";

export type CreateAdminComplianceServicesInput = {
  domainEvents: IAdminDomainEventQueryService;
  legalEntityRepository: ILegalEntityRepository;
  legalEntityLifecycleAdminService: LegalEntityLifecycleAdminService;
  legalEntityDocumentAdminService: LegalEntityDocumentAdminService;
  adminDisputeCaseEnrichmentReader: IAdminDisputeCaseEnrichmentReader;
  amlService: AmlService;
  amlScreeningReader: IWatchlistScreeningReader;
  adminSourceOfFundsQueryService: AdminSourceOfFundsQueryService;
  sourceOfFundsService: SourceOfFundsService;
  sourceOfFundsDocumentCollectionService: SourceOfFundsDocumentCollectionService;
  sourceOfFundsDocumentReviewService: SourceOfFundsDocumentReviewService;
  env: Pick<Env, "WEB_ORIGIN" | "WEB_ORIGINS" | "SSR_TRUSTED_ORIGINS">;
};

export function createAdminComplianceServices(
  input: CreateAdminComplianceServicesInput,
): AdminComplianceRouteServices {
  return {
    disputeCases: new AdminDisputeCaseQueryService(
      input.domainEvents,
      input.adminDisputeCaseEnrichmentReader,
    ),
    legalEntityLifecycle: new AdminLegalEntityLifecycleApplicationService(
      input.legalEntityRepository,
      input.legalEntityLifecycleAdminService,
      input.legalEntityDocumentAdminService,
    ),
    aml: new AdminAmlApplicationService(input.amlService, input.amlScreeningReader),
    sourceOfFunds: new AdminSourceOfFundsApplicationService(
      input.adminSourceOfFundsQueryService,
      input.sourceOfFundsService,
      input.sourceOfFundsDocumentCollectionService,
      input.sourceOfFundsDocumentReviewService,
      {
        WEB_ORIGIN: input.env.WEB_ORIGIN,
        WEB_ORIGINS: input.env.WEB_ORIGINS,
        SSR_TRUSTED_ORIGINS: input.env.SSR_TRUSTED_ORIGINS,
      },
    ),
  };
}
