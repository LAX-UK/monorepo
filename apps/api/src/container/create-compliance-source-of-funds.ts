import type { Env } from "../env.js";
import { AdminSourceOfFundsQueryService } from "../services/admin/admin-source-of-funds-query.service.js";
import type { MediaUrlResolver } from "../services/media-url-resolver.js";
import { PerRequestSigningPolicy } from "../services/signed-url-policy.js";
import { SourceOfFundsDocumentCollectionService } from "../services/source-of-funds/source-of-funds-document-collection.service.js";
import { SourceOfFundsDocumentReviewService } from "../services/source-of-funds/source-of-funds-document-review.service.js";
import { SourceOfFundsSettlementReadService } from "../services/source-of-funds/source-of-funds-settlement-read.service.js";
import { SourceOfFundsService } from "../services/source-of-funds/source-of-funds.service.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerComplianceSourceOfFunds = {
  sourceOfFundsService: SourceOfFundsService;
  adminSourceOfFundsQueryService: AdminSourceOfFundsQueryService;
  sourceOfFundsDocumentCollectionService: SourceOfFundsDocumentCollectionService;
  sourceOfFundsDocumentReviewService: SourceOfFundsDocumentReviewService;
};

export type CreateComplianceSourceOfFundsInput = {
  env: Env;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  mediaUrlResolver: MediaUrlResolver;
  objectStorage: ContainerInfra["objectStorage"];
};

export function createComplianceSourceOfFunds(
  input: CreateComplianceSourceOfFundsInput,
): ContainerComplianceSourceOfFunds {
  const { env, repos, platform, mediaUrlResolver, objectStorage } = input;
  const {
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    sourceOfFundsSettlementReader,
    adminUserReader,
    uploadObjectReader,
  } = repos;
  const { domainEventSink, transactionRunner } = platform;

  const sourceOfFundsService = new SourceOfFundsService(
    sourceOfFundsRepository,
    {
      thresholdAmount: env.SOF_THRESHOLD_AMOUNT,
      currency: env.SOF_THRESHOLD_CURRENCY,
      approvalValidityDays: env.SOF_APPROVAL_VALIDITY_DAYS,
    },
    transactionRunner,
    domainEventSink,
  );
  const sourceOfFundsSettlementReadService = new SourceOfFundsSettlementReadService(
    sourceOfFundsSettlementReader,
  );
  const adminSourceOfFundsQueryService = new AdminSourceOfFundsQueryService(
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    adminUserReader,
    sourceOfFundsSettlementReadService,
    mediaUrlResolver,
  );
  const sourceOfFundsDocumentCollectionService = new SourceOfFundsDocumentCollectionService(
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    uploadObjectReader,
    transactionRunner,
    domainEventSink,
    objectStorage,
    new PerRequestSigningPolicy(env.SOF_DOWNLOAD_TTL_SEC),
    sourceOfFundsSettlementReadService,
  );
  const sourceOfFundsDocumentReviewService = new SourceOfFundsDocumentReviewService(
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    transactionRunner,
    domainEventSink,
  );

  return {
    sourceOfFundsService,
    adminSourceOfFundsQueryService,
    sourceOfFundsDocumentCollectionService,
    sourceOfFundsDocumentReviewService,
  };
}
