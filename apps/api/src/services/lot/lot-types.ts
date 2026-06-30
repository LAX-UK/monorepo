import type { Database } from "@auction/db";
import type { Bid, Lot } from "@auction/types";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ImageCleanupService } from "../image-cleanup.service.js";
import type { ILotJobScheduler } from "../interfaces/job-scheduler.js";
import type { ILegalEntityNotificationRecipientReader } from "../interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { ILotNotificationCoordinator } from "../interfaces/lot-notifications.js";
import type {
  IBidRepository,
  ILotRepository,
  ISaleRepository,
} from "../interfaces/repositories.js";
import type { IRepositoryFactory } from "../interfaces/repository-factory.js";
import type { ITelephoneBidBookingService } from "../interfaces/telephone-bid-booking-service.js";
import type { IWatchlistRepository } from "../interfaces/watchlist.js";
import type { LotLifecycleRecording } from "../lot-lifecycle-recording.service.js";
import type { MediaAssetEnricher } from "../media-asset-enricher.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type { QrCodeService } from "../qr-code.service.js";

export const CANCELLABLE: ReadonlySet<Lot["status"]> = new Set(["draft", "scheduled", "active"]);

export const SELLER_WITHDRAW_ROLES = new Set(["owner", "admin"]);

export type LotBidPublicApiRow = Omit<Bid, "placedByUserId"> & {
  bidderRef: string;
  placedByUserId: string | null;
};

export type ListBidsForPublicApiResult =
  | { kind: "not_found" }
  | { kind: "ok"; data: LotBidPublicApiRow[] };

/** Resolved deps record built once in LotService constructor (post-default coalescing). */
export type LotServiceDeps = {
  lotRepo: ILotRepository;
  saleRepo: ISaleRepository | null;
  bids: IBidRepository;
  watchlist: IWatchlistRepository;
  jobScheduler: ILotJobScheduler | null;
  lotNotifications: ILotNotificationCoordinator | null;
  imageCleanup: ImageCleanupService | undefined;
  legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader | null;
  legalEntityRepository: ILegalEntityRepository | null;
  enforceIndividualConnectOnPublish: boolean;
  db: Database | null;
  domainEventPublisher: DomainEventPublisher | null;
  catalogueMediaUrlResolver: MediaUrlResolver | undefined;
  mediaAssetEnricher: MediaAssetEnricher | undefined;
  englishOnlyAuctions: boolean;
  lotLifecycleRecording: LotLifecycleRecording | null;
  qrCodeService: QrCodeService | null;
  telephoneBidBookingService: ITelephoneBidBookingService | null;
  repoFactory: IRepositoryFactory | null;
};
