import type { Database } from "@auction/db";
import type { ILegalEntityRepository, ITransactionRunner } from "@auction/persistence/interfaces";
import type { AmlService } from "../services/aml/aml.service.js";
import { BuyerComplianceHttpApplicationService } from "../services/compliance/buyer-compliance-http-application.service.js";
import { ExportHttpApplicationService } from "../services/compliance/export-http-application.service.js";
import { KycHttpApplicationService } from "../services/compliance/kyc-http-application.service.js";
import { LotDocumentHttpApplicationService } from "../services/compliance/lot-document-http-application.service.js";
import { SaleDocumentHttpApplicationService } from "../services/compliance/sale-document-http-application.service.js";
import { UploadHttpApplicationService } from "../services/compliance/upload-http-application.service.js";
import { VeriffWebhookIngressApplicationService } from "../services/compliance/veriff-webhook-ingress-application.service.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { EntityDocumentService } from "../services/entity-document.service.js";
import type { ExportService } from "../services/export/export.service.js";
import type { ComplianceRouteServices } from "../services/interfaces/compliance-routes/index.js";
import type { IKycService } from "../services/interfaces/kyc-service.js";
import type { IMarketingEventService } from "../services/interfaces/marketing-event-service.js";
import type { IStripeConnectService } from "../services/interfaces/stripe-connect.js";
import type { IUploadService } from "../services/interfaces/upload-service.js";
import type { IEnquiryDraftTokens } from "../services/marketing-enquiry/enquiry-draft-token.js";
import type { SourceOfFundsDocumentCollectionService } from "../services/source-of-funds/source-of-funds-document-collection.service.js";
import type { IStaffStepUpGuard } from "../services/staff-step-up.service.js";

export type CreateComplianceRouteServicesInput = {
  /** Recent sign-in check for staff on shared routes (exports of personal data). */
  staffStepUp: IStaffStepUpGuard;
  db: Database;
  transactionRunner: ITransactionRunner;
  legalEntityRepository: ILegalEntityRepository;
  domainEventSink: IDomainEventSink | undefined;
  kycService: IKycService;
  amlService: AmlService;
  stripeConnectService: IStripeConnectService;
  marketingEventService: IMarketingEventService;
  sourceOfFundsDocumentCollectionService: SourceOfFundsDocumentCollectionService;
  uploadService: IUploadService;
  exportService: ExportService;
  lotDocumentService: EntityDocumentService<string>;
  saleDocumentService: EntityDocumentService<string>;
  storageDriver: string;
  /** Checks the token a visitor uploads enquiry files under. */
  enquiryDrafts: IEnquiryDraftTokens;
};

export function createComplianceRouteServices(
  input: CreateComplianceRouteServicesInput,
): ComplianceRouteServices {
  return {
    veriffWebhooks: new VeriffWebhookIngressApplicationService({
      db: input.db,
      transactionRunner: input.transactionRunner,
      legalEntityRepository: input.legalEntityRepository,
      domainEventSink: input.domainEventSink,
      kycService: input.kycService,
      amlService: input.amlService,
      stripeConnectService: input.stripeConnectService,
      marketingEventService: input.marketingEventService,
    }),
    buyerComplianceHttp: new BuyerComplianceHttpApplicationService(
      input.sourceOfFundsDocumentCollectionService,
    ),
    kycHttp: new KycHttpApplicationService(input.kycService),
    uploadHttp: new UploadHttpApplicationService(
      input.uploadService,
      input.storageDriver,
      input.enquiryDrafts,
    ),
    exportHttp: new ExportHttpApplicationService(input.exportService),
    staffStepUp: input.staffStepUp,
    lotDocumentHttp: new LotDocumentHttpApplicationService(input.lotDocumentService),
    saleDocumentHttp: new SaleDocumentHttpApplicationService(input.saleDocumentService),
  };
}
