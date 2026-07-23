import type { Database } from "@auction/db";
import type { IClickIdStore, IMarketingEventPublisher } from "@auction/marketing-events";
import type { IWatchlistScreeningReader } from "@auction/persistence/interfaces";
import type { Env } from "../env.js";
import type { AdminSourceOfFundsQueryService } from "../services/admin/admin-source-of-funds-query.service.js";
import type { LegalEntityDocumentAdminService } from "../services/admin/legal-entity-document-admin.service.js";
import type { AmlService } from "../services/aml/aml.service.js";
import type { EntityDocumentService } from "../services/entity-document.service.js";
import type { ExportService } from "../services/export/export.service.js";
import type { ImageCleanupService } from "../services/image-cleanup.service.js";
import type { IKycService } from "../services/interfaces/kyc-service.js";
import type { IMarketingEventService } from "../services/interfaces/marketing-event-service.js";
import type { IUploadService } from "../services/interfaces/upload-service.js";
import type { KycResubmissionNotifier } from "../services/kyc/kyc-resubmission-notifier.js";
import type { MediaAssetEnricher } from "../services/media-asset-enricher.js";
import type { MediaUrlResolver } from "../services/media-url-resolver.js";
import type { SourceOfFundsDocumentCollectionService } from "../services/source-of-funds/source-of-funds-document-collection.service.js";
import type { SourceOfFundsDocumentReviewService } from "../services/source-of-funds/source-of-funds-document-review.service.js";
import type { SourceOfFundsService } from "../services/source-of-funds/source-of-funds.service.js";
import { createComplianceKycAml } from "./create-compliance-kyc-aml.js";
import { createComplianceMarketing } from "./create-compliance-marketing.js";
import { createComplianceSourceOfFunds } from "./create-compliance-source-of-funds.js";
import { createComplianceUploadExportMedia } from "./create-compliance-upload-export-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerComplianceMedia = {
  marketingEventService: IMarketingEventService;
  marketingEventPublisher: IMarketingEventPublisher;
  clickIdStore: IClickIdStore;
  kycService: IKycService;
  kycResubmissionNotifier: KycResubmissionNotifier;
  amlService: AmlService;
  amlScreeningReader: IWatchlistScreeningReader;
  sourceOfFundsService: SourceOfFundsService;
  adminSourceOfFundsQueryService: AdminSourceOfFundsQueryService;
  sourceOfFundsDocumentCollectionService: SourceOfFundsDocumentCollectionService;
  sourceOfFundsDocumentReviewService: SourceOfFundsDocumentReviewService;
  exportService: ExportService;
  mediaUrlResolver: MediaUrlResolver;
  catalogueMediaUrlResolver: MediaUrlResolver;
  mediaAssetEnricher: MediaAssetEnricher;
  legalEntityDocumentAdminService: LegalEntityDocumentAdminService;
  imageCleanupService: ImageCleanupService;
  uploadService: IUploadService;
  lotDocumentService: EntityDocumentService<string>;
  saleDocumentService: EntityDocumentService<string>;
  submissionDocumentService: EntityDocumentService<string>;
};

export type CreateComplianceMediaInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
};

export function createComplianceMedia(input: CreateComplianceMediaInput): ContainerComplianceMedia {
  const { env, db, infra, repos, platform } = input;

  const marketing = createComplianceMarketing({ env, db, infra });
  const kycAml = createComplianceKycAml({
    env,
    infra,
    repos,
    platform,
    marketing,
  });
  const uploadExportMedia = createComplianceUploadExportMedia({
    env,
    db,
    infra,
    repos,
    platform,
  });
  const sourceOfFunds = createComplianceSourceOfFunds({
    env,
    repos,
    platform,
    mediaUrlResolver: uploadExportMedia.mediaUrlResolver,
    objectStorage: infra.objectStorage,
  });

  return {
    ...marketing,
    ...kycAml,
    ...sourceOfFunds,
    ...uploadExportMedia,
  };
}
