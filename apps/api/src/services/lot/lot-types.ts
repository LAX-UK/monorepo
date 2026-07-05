import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { ILegalEntityNotificationRecipientReader } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type {
  IBidRepository,
  ILotRepository,
  ISaleRepository,
} from "@auction/persistence/interfaces";
import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { IWatchlistRepository } from "@auction/persistence/interfaces";
import type { Bid, Lot } from "@auction/types";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IImageCleanup } from "../interfaces/image-cleanup.js";
import type { ILotJobScheduler } from "../interfaces/job-scheduler.js";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { ILotNotificationCoordinator } from "../interfaces/lot-notifications.js";
import type { IMediaAssetEnricher } from "../interfaces/media-asset-enricher.js";
import type { IMediaUrlResolver } from "../interfaces/media-url-resolver.js";
import type { IQrCodeService } from "../interfaces/qr-code-service.js";
import type { ITelephoneBidBookingSaleroomBridge } from "../interfaces/telephone-bid-booking-service.js";

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
  imageCleanup: IImageCleanup | undefined;
  legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader | null;
  legalEntityRepository: ILegalEntityRepository | null;
  enforceIndividualConnectOnPublish: boolean;
  adminReviewTaskRepository:
    | import("@auction/persistence/interfaces").IAdminReviewTaskRepository
    | null;
  transactionRunner: ITransactionRunner | null;
  domainEventSink: IDomainEventSink | null;
  catalogueMediaUrlResolver: IMediaUrlResolver | undefined;
  mediaAssetEnricher: IMediaAssetEnricher | undefined;
  englishOnlyAuctions: boolean;
  lotLifecycleRecording: ILotLifecycleRecorder | null;
  qrCodeService: IQrCodeService | null;
  telephoneBidBookingService: ITelephoneBidBookingSaleroomBridge | null;
  repoFactory: IRepositoryFactory | null;
};
