import type { Database } from "@auction/db";
import type { PlatformCatalogLegalEntityIdProvider } from "../../lib/platform-catalog-legal-entity.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ImageCleanupService } from "../image-cleanup.service.js";
import type { ILotJobScheduler } from "../interfaces/job-scheduler.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { ILotRepository, ISaleRepository } from "../interfaces/repositories.js";
import type { IRepositoryFactory } from "../interfaces/repository-factory.js";
import type { IVenueRepository } from "../interfaces/venue.js";
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
  db: Database | undefined;
  domainEventPublisher: DomainEventPublisher | null;
  lotLifecycleRecording: ILotLifecycleRecorder | null;
  legalEntityRepository: ILegalEntityRepository | null;
  venueRepository: IVenueRepository | null;
  enforceIndividualConnectOnPublish: boolean;
  qrCodeService: QrCodeService | null;
  repoFactory: IRepositoryFactory | null;
};
