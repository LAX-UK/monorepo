import type { Database } from "@auction/db";
import { DrizzleExportJobRepository } from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import { createExportProviders } from "../exports/registry.js";
import { LegalEntityDocumentAdminService } from "../services/admin/legal-entity-document-admin.service.js";
import { EntityDocumentService } from "../services/entity-document.service.js";
import { ExportFileStorage } from "../services/export/export-file-storage.js";
import { RedisExportProgressStore } from "../services/export/export-progress.store.js";
import { ExportService } from "../services/export/export.service.js";
import { ImageCleanupService } from "../services/image-cleanup.service.js";
import type { IUploadService } from "../services/interfaces/upload-service.js";
import { MediaAssetEnricher } from "../services/media-asset-enricher.js";
import { MediaUrlResolver } from "../services/media-url-resolver.js";
import { PerRequestSigningPolicy, StableSigningPolicy } from "../services/signed-url-policy.js";
import { UploadService } from "../services/upload.service.js";
import { UploadAuthorizationService } from "../services/upload/upload-authorization.service.js";
import { UploadRateLimitPolicy } from "../services/upload/upload-rate-limit.policy.js";
import { UploadValidationDispatcher } from "../services/upload/upload-validation.dispatcher.js";
import { createExportProviderDeps } from "./create-export-provider-deps.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerComplianceUploadExportMedia = {
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

export type CreateComplianceUploadExportMediaInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
};

export function createComplianceUploadExportMedia(
  input: CreateComplianceUploadExportMediaInput,
): ContainerComplianceUploadExportMedia {
  const { env, db, infra, repos, platform } = input;
  const { redis, objectStorage, dataExportQueue, imageCleanupQueue, uploadValidationQueue } = infra;
  const {
    lotDocumentRepo,
    saleDocumentRepo,
    submissionDocumentRepo,
    uploadPersistenceRepository,
    legalEntityDocumentAdminRepository,
    mediaAssetReader,
    uploadObjectReader,
  } = repos;

  const exportProviderDeps = createExportProviderDeps(db, repos);
  const exportProviders = createExportProviders(exportProviderDeps);
  const exportJobRepo = new DrizzleExportJobRepository(db);
  const exportService = new ExportService(
    exportJobRepo,
    new RedisExportProgressStore(redis),
    new ExportFileStorage(objectStorage),
    dataExportQueue,
    exportProviders,
    {
      syncMaxRows: env.EXPORT_SYNC_MAX_ROWS,
      staleProcessingMs: env.EXPORT_STALE_PROCESSING_MS,
    },
    platform.domainEventSink,
  );
  const mediaUrlResolver = new MediaUrlResolver(
    objectStorage,
    env.STORAGE_READ_MODE,
    new PerRequestSigningPolicy(env.SIGNED_GET_TTL_SEC),
  );
  const catalogueMediaUrlResolver = new MediaUrlResolver(
    objectStorage,
    env.STORAGE_READ_MODE,
    new StableSigningPolicy(Math.max(env.SIGNED_GET_TTL_SEC, 86_400)),
  );
  const mediaAssetEnricher = new MediaAssetEnricher(mediaAssetReader, objectStorage);
  const legalEntityDocumentAdminService = new LegalEntityDocumentAdminService(
    legalEntityDocumentAdminRepository,
    objectStorage,
    mediaUrlResolver,
  );
  const imageCleanupService = new ImageCleanupService(objectStorage, imageCleanupQueue);
  const uploadAuth = new UploadAuthorizationService(uploadPersistenceRepository);
  const uploadRateLimit = new UploadRateLimitPolicy(redis);
  const uploadValidation = new UploadValidationDispatcher(uploadValidationQueue);
  const uploadService = new UploadService(
    objectStorage,
    {
      repo: uploadPersistenceRepository,
      auth: uploadAuth,
      rateLimit: uploadRateLimit,
      validation: uploadValidation,
    },
    redis,
    uploadValidationQueue,
    mediaUrlResolver,
  );
  const lotDocumentService = new EntityDocumentService(
    "lot",
    lotDocumentRepo,
    uploadObjectReader,
    objectStorage,
    mediaUrlResolver,
  );
  const saleDocumentService = new EntityDocumentService(
    "sale",
    saleDocumentRepo,
    uploadObjectReader,
    objectStorage,
    mediaUrlResolver,
  );
  const submissionDocumentService = new EntityDocumentService(
    "submission",
    submissionDocumentRepo,
    uploadObjectReader,
    objectStorage,
    mediaUrlResolver,
  );

  return {
    exportService,
    mediaUrlResolver,
    catalogueMediaUrlResolver,
    mediaAssetEnricher,
    legalEntityDocumentAdminService,
    imageCleanupService,
    uploadService,
    lotDocumentService,
    saleDocumentService,
    submissionDocumentService,
  };
}
