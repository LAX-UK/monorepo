import type { Database } from "@auction/db";
import type { CreateLotInput, Lot, PublicLotView, UserRole } from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import { type Result, err } from "neverthrow";
import type { LotCancelledPayload } from "../domain/lot-events.js";
import { type AuthzError, LotError } from "../lib/errors.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { ImageCleanupService } from "./image-cleanup.service.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILegalEntityNotificationRecipientReader } from "./interfaces/legal-entity-notification-recipients.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotNotificationCoordinator } from "./interfaces/lot-notifications.js";
import type {
  ArchiveEndedAggregateFilter,
  IBidRepository,
  ILotRepository,
  ISaleRepository,
  ListLotsFilter,
} from "./interfaces/repositories.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import type { ITelephoneBidBookingService } from "./interfaces/telephone-bid-booking-service.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";
import type { LotLifecycleRecording } from "./lot-lifecycle-recording.service.js";
import type { LotTransitionOrchestrator } from "./lot-transition-orchestrator.js";
import { createLot } from "./lot/lot-create.js";
import { bulkPublishOrCancel, cancelLot, publishLot } from "./lot/lot-lifecycle.js";
import {
  countWatchersForPublicApi,
  listBidsForPublicApi,
  listLotsForPublicApi,
} from "./lot/lot-public-api.js";
import { archiveEndedSummary, countMatching, getById, list } from "./lot/lot-read.js";
import type { ListBidsForPublicApiResult, LotServiceDeps } from "./lot/lot-types.js";
import { updateLot, updateLotMarketingDetails } from "./lot/lot-update.js";
import { approveWithdrawalRequest, requestWithdrawal } from "./lot/lot-withdrawal.js";
import type { MediaAssetEnricher } from "./media-asset-enricher.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import type { QrCodeService } from "./qr-code.service.js";

export type { ListBidsForPublicApiResult, LotBidPublicApiRow } from "./lot/lot-types.js";

export type LotServiceOptions = {
  lotRepo: ILotRepository;
  saleRepo?: ISaleRepository | null;
  bids: IBidRepository;
  watchlist: IWatchlistRepository;
  jobScheduler: ILotJobScheduler | null;
  lotNotifications: ILotNotificationCoordinator | null;
  imageCleanup?: ImageCleanupService;
  legalEntityNotificationRecipients?: ILegalEntityNotificationRecipientReader | null;
  legalEntityRepository?: ILegalEntityRepository | null;
  /** When false (e.g. Stripe Connect not configured), individual Connect readiness is not enforced on publish. */
  enforceIndividualConnectOnPublish?: boolean;
  db?: Database | null;
  domainEventPublisher?: DomainEventPublisher | null;
  mediaUrlResolver?: MediaUrlResolver;
  catalogueMediaUrlResolver?: MediaUrlResolver;
  mediaAssetEnricher?: MediaAssetEnricher;
  englishOnlyAuctions?: boolean;
  lotLifecycleRecording?: LotLifecycleRecording | null;
  lotTransitionOrchestrator?: LotTransitionOrchestrator | null;
  qrCodeService?: QrCodeService | null;
  telephoneBidBookingService?: ITelephoneBidBookingService | null;
  repoFactory?: IRepositoryFactory | null;
};

export class LotService {
  private readonly deps: LotServiceDeps;
  private readonly _lotTransitionOrchestrator: LotTransitionOrchestrator | null;

  constructor(opts: LotServiceOptions) {
    this.deps = {
      lotRepo: opts.lotRepo,
      saleRepo: opts.saleRepo ?? null,
      bids: opts.bids,
      watchlist: opts.watchlist,
      jobScheduler: opts.jobScheduler,
      lotNotifications: opts.lotNotifications,
      imageCleanup: opts.imageCleanup,
      legalEntityNotificationRecipients: opts.legalEntityNotificationRecipients ?? null,
      legalEntityRepository: opts.legalEntityRepository ?? null,
      enforceIndividualConnectOnPublish: opts.enforceIndividualConnectOnPublish ?? false,
      db: opts.db ?? null,
      domainEventPublisher: opts.domainEventPublisher ?? null,
      catalogueMediaUrlResolver: opts.catalogueMediaUrlResolver ?? opts.mediaUrlResolver,
      mediaAssetEnricher: opts.mediaAssetEnricher,
      englishOnlyAuctions: opts.englishOnlyAuctions ?? false,
      lotLifecycleRecording: opts.lotLifecycleRecording ?? null,
      qrCodeService: opts.qrCodeService ?? null,
      telephoneBidBookingService: opts.telephoneBidBookingService ?? null,
      repoFactory: opts.repoFactory ?? null,
    };
    this._lotTransitionOrchestrator = opts.lotTransitionOrchestrator ?? null;
  }

  returnToInventory(
    actorUserId: string,
    userRole: string,
    lotId: string,
    input: Parameters<LotTransitionOrchestrator["returnToInventory"]>[3],
    userStaffRole?: string | null,
  ) {
    if (!this._lotTransitionOrchestrator) {
      return Promise.resolve(err(new LotError("Return to inventory is not configured", 500)));
    }
    return this._lotTransitionOrchestrator.returnToInventory(
      actorUserId,
      userRole,
      lotId,
      input,
      userStaffRole,
    );
  }

  create(_sellerId: string, input: CreateLotInput): Promise<Result<Lot, LotError>> {
    return createLot(this.deps, _sellerId, input);
  }

  publish(
    _userId: string,
    userRole: string,
    lotId: string,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    return publishLot(this.deps, _userId, userRole, lotId, userStaffRole);
  }

  cancel(
    _userId: string,
    userRole: string,
    lotId: string,
    userStaffRole?: string | null,
    cancelReason: LotCancelledPayload["reason"] = "manual",
  ): Promise<Result<Lot, LotError | AuthzError>> {
    return cancelLot(this.deps, _userId, userRole, lotId, userStaffRole, cancelReason);
  }

  update(
    userRole: string,
    lotId: string,
    input: Partial<CreateLotInput>,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    return updateLot(this.deps, userRole, lotId, input, userStaffRole);
  }

  updateMarketingDetails(
    userRole: string,
    lotId: string,
    patch: UpdateLotMarketingDetailsInput,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    return updateLotMarketingDetails(this.deps, userRole, lotId, patch, userStaffRole);
  }

  getById(id: string): Promise<Lot | null> {
    return getById(this.deps, id);
  }

  list(filter: ListLotsFilter): Promise<Lot[]> {
    return list(this.deps, filter);
  }

  listLotsForPublicApi(
    filter: ListLotsFilter,
    viewerRole: string | undefined,
    viewerStaffRole?: string | null,
  ): Promise<{ data: (Lot | PublicLotView)[] }> {
    return listLotsForPublicApi(this.deps, filter, viewerRole, viewerStaffRole);
  }

  bulkPublishOrCancel(
    userId: string,
    userRole: string,
    ids: string[],
    op: "publish" | "cancel",
    userStaffRole?: string | null,
    reason?: string,
  ): Promise<
    Result<
      {
        attempted: number;
        failed: number;
        errors: Array<{ lotId: string; message: string; code?: string }>;
      },
      AuthzError
    >
  > {
    return bulkPublishOrCancel(this.deps, userId, userRole, ids, op, userStaffRole, reason);
  }

  listBidsForPublicApi(input: {
    lotId: string;
    viewerRole: UserRole;
    viewerStaffRole?: string | null;
    viewerId: string | undefined;
    limitQuery: string | undefined;
  }): Promise<ListBidsForPublicApiResult> {
    return listBidsForPublicApi(this.deps, input);
  }

  countWatchersForPublicApi(
    lotId: string,
  ): Promise<{ kind: "ok"; count: number } | { kind: "not_found" }> {
    return countWatchersForPublicApi(this.deps, lotId);
  }

  countMatching(filter: Omit<ListLotsFilter, "limit" | "offset" | "sort">): Promise<number> {
    return countMatching(this.deps, filter);
  }

  archiveEndedSummary(filter: ArchiveEndedAggregateFilter) {
    return archiveEndedSummary(this.deps, filter);
  }

  requestWithdrawal(
    sellerUserId: string,
    lotId: string,
  ): Promise<Result<{ taskId: string; alreadyPending: boolean }, LotError | AuthzError>> {
    return requestWithdrawal(this.deps, sellerUserId, lotId);
  }

  approveWithdrawalRequest(
    adminUserId: string,
    adminRole: UserRole,
    lotId: string,
    adminStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    return approveWithdrawalRequest(this.deps, adminUserId, adminRole, lotId, adminStaffRole);
  }
}
