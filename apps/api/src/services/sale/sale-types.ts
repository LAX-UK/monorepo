import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { IVenueRepository } from "@auction/persistence/interfaces";
import type { PlatformCatalogLegalEntityIdProvider } from "../../lib/platform-catalog-legal-entity.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IImageCleanup } from "../interfaces/image-cleanup.js";
import type { ILotJobScheduler } from "../interfaces/job-scheduler.js";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { IMediaAssetEnricher } from "../interfaces/media-asset-enricher.js";
import type { IMediaUrlResolver } from "../interfaces/media-url-resolver.js";
import type { IQrCodeService } from "../interfaces/qr-code-service.js";

/** Optional follow state for public sale detail responses. */
export type SaleFollowReader = {
  isFollowing(userId: string, saleId: string): Promise<boolean>;
};

/** Resolved deps record built once in SaleService constructor (post-default coalescing). */
export type SaleServiceDeps = {
  saleRepo: ISaleRepository;
  lotRepo: ILotRepository;
  jobScheduler: ILotJobScheduler | null;
  resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  imageCleanup: IImageCleanup | undefined;
  saleFollowReader: SaleFollowReader | null;
  mediaUrlResolver: IMediaUrlResolver | undefined;
  catalogueMediaUrlResolver: IMediaUrlResolver | undefined;
  mediaAssetEnricher: IMediaAssetEnricher | undefined;
  englishOnlyAuctions: boolean;
  transactionRunner: ITransactionRunner | null;
  domainEventSink: IDomainEventSink | null;
  lotLifecycleRecording: ILotLifecycleRecorder | null;
  legalEntityRepository: ILegalEntityRepository | null;
  venueRepository: IVenueRepository | null;
  enforceIndividualConnectOnPublish: boolean;
  qrCodeService: IQrCodeService | null;
  repoFactory: IRepositoryFactory | null;
};
