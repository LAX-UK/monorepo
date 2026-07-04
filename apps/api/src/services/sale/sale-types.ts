import type { ITransactionRunner } from "@auction/persistence";
import type { ILegalEntityRepository } from "@auction/persistence";
import type { ILotRepository, ISaleRepository } from "@auction/persistence";
import type { IRepositoryFactory } from "@auction/persistence";
import type { IVenueRepository } from "@auction/persistence";
import type { PlatformCatalogLegalEntityIdProvider } from "../../lib/platform-catalog-legal-entity.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { ImageCleanupService } from "../image-cleanup.service.js";
import type { ILotJobScheduler } from "../interfaces/job-scheduler.js";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { MediaAssetEnricher } from "../media-asset-enricher.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type { QrCodeService } from "../qr-code.service.js";

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
  imageCleanup: ImageCleanupService | undefined;
  saleFollowReader: SaleFollowReader | null;
  mediaUrlResolver: MediaUrlResolver | undefined;
  catalogueMediaUrlResolver: MediaUrlResolver | undefined;
  mediaAssetEnricher: MediaAssetEnricher | undefined;
  englishOnlyAuctions: boolean;
  transactionRunner: ITransactionRunner | null;
  domainEventSink: IDomainEventSink | null;
  lotLifecycleRecording: ILotLifecycleRecorder | null;
  legalEntityRepository: ILegalEntityRepository | null;
  venueRepository: IVenueRepository | null;
  enforceIndividualConnectOnPublish: boolean;
  qrCodeService: QrCodeService | null;
  repoFactory: IRepositoryFactory | null;
};
