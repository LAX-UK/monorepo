import type { PublicBidHistory } from "@auction/domain";
import type { ISaleChannelReader, ITransactionRunner } from "@auction/persistence/interfaces";
import type { ILegalEntityNotificationRecipientReader } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type {
  ArchiveEndedAggregateFilter,
  IBidRepository,
  ILotRepository,
  ISaleRepository,
  ListLotsFilter,
} from "@auction/persistence/interfaces";
import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { IWatchlistRepository } from "@auction/persistence/interfaces";
import type { CreateLotInput, Lot, PublicLotView, StaffRoles, UserRole } from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import { type Result, err } from "neverthrow";
import type { LotCancelledPayload } from "../domain/lot-events.js";
import { type AuthzError, LotError } from "../lib/errors.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IImageCleanup } from "./interfaces/image-cleanup.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotLifecycleRecorder } from "./interfaces/lot-lifecycle-recorder.js";
import type { ILotNotificationCoordinator } from "./interfaces/lot-notifications.js";
import type { ILotService } from "./interfaces/lot-service.js";
import type { IMediaAssetEnricher } from "./interfaces/media-asset-enricher.js";
import type { IMediaUrlResolver } from "./interfaces/media-url-resolver.js";
import type { IQrCodeService } from "./interfaces/qr-code-service.js";
import type { ITelephoneBidBookingSaleroomBridge } from "./interfaces/telephone-bid-booking-service.js";
import type { LotTransitionOrchestrator } from "./lot-transition-orchestrator.js";
import { createLot } from "./lot/lot-create.js";
import { bulkPublishOrCancel, cancelLot, publishLot } from "./lot/lot-lifecycle.js";
import {
  countWatchersForPublicApi,
  listBidsForPublicApi,
  listLotsForPublicApi,
  listPublicBidHistory,
} from "./lot/lot-public-api.js";
import { archiveEndedSummary, countMatching, getById, list } from "./lot/lot-read.js";
import type { ListBidsForPublicApiResult, LotServiceDeps } from "./lot/lot-types.js";
import { updateLot, updateLotMarketingDetails } from "./lot/lot-update.js";
import {
  approveWithdrawalRequest,
  declineWithdrawalRequest,
  requestWithdrawal,
} from "./lot/lot-withdrawal.js";

export type { ListBidsForPublicApiResult, LotBidPublicApiRow } from "./lot/lot-types.js";

export type LotServiceOptions = {
  lotRepo: ILotRepository;
  saleRepo?: ISaleRepository | null;
  bids: IBidRepository;
  watchlist: IWatchlistRepository;
  jobScheduler: ILotJobScheduler | null;
  lotNotifications: ILotNotificationCoordinator | null;
  imageCleanup?: IImageCleanup;
  legalEntityNotificationRecipients?: ILegalEntityNotificationRecipientReader | null;
  legalEntityRepository?: ILegalEntityRepository | null;
  /** When false (e.g. Stripe Connect not configured), individual Connect readiness is not enforced on publish. */
  enforceIndividualConnectOnPublish?: boolean;
  adminReviewTaskRepository?:
    | import("@auction/persistence/interfaces").IAdminReviewTaskRepository
    | null;
  transactionRunner?: ITransactionRunner | null;
  domainEventSink?: IDomainEventSink | null;
  mediaUrlResolver?: IMediaUrlResolver;
  catalogueMediaUrlResolver?: IMediaUrlResolver;
  mediaAssetEnricher?: IMediaAssetEnricher;
  englishOnlyAuctions?: boolean;
  lotLifecycleRecording?: ILotLifecycleRecorder | null;
  lotTransitionOrchestrator?: LotTransitionOrchestrator | null;
  qrCodeService?: IQrCodeService | null;
  telephoneBidBookingService?: ITelephoneBidBookingSaleroomBridge | null;
  repoFactory?: IRepositoryFactory | null;
  saleChannelReader?: ISaleChannelReader | null;
};

export class LotService implements ILotService {
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
      adminReviewTaskRepository: opts.adminReviewTaskRepository ?? null,
      transactionRunner: opts.transactionRunner ?? null,
      domainEventSink: opts.domainEventSink ?? null,
      catalogueMediaUrlResolver: opts.catalogueMediaUrlResolver ?? opts.mediaUrlResolver,
      mediaAssetEnricher: opts.mediaAssetEnricher,
      englishOnlyAuctions: opts.englishOnlyAuctions ?? false,
      lotLifecycleRecording: opts.lotLifecycleRecording ?? null,
      qrCodeService: opts.qrCodeService ?? null,
      telephoneBidBookingService: opts.telephoneBidBookingService ?? null,
      repoFactory: opts.repoFactory ?? null,
      saleChannelReader: opts.saleChannelReader ?? null,
    };
    this._lotTransitionOrchestrator = opts.lotTransitionOrchestrator ?? null;
  }

  returnToInventory(
    actorUserId: string,
    userRole: string,
    lotId: string,
    input: Parameters<LotTransitionOrchestrator["returnToInventory"]>[3],
    userStaffRoles?: StaffRoles | undefined,
  ) {
    if (!this._lotTransitionOrchestrator) {
      return Promise.resolve(err(new LotError("Return to inventory is not configured", 500)));
    }
    return this._lotTransitionOrchestrator.returnToInventory(
      actorUserId,
      userRole,
      lotId,
      input,
      userStaffRoles,
    );
  }

  create(_sellerId: string, input: CreateLotInput): Promise<Result<Lot, LotError>> {
    return createLot(this.deps, _sellerId, input);
  }

  publish(
    _userId: string,
    userRole: string,
    lotId: string,
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    return publishLot(this.deps, _userId, userRole, lotId, userStaffRoles);
  }

  cancel(
    _userId: string,
    userRole: string,
    lotId: string,
    userStaffRoles?: StaffRoles | undefined,
    cancelReason: LotCancelledPayload["reason"] = "manual",
  ): Promise<Result<Lot, LotError | AuthzError>> {
    return cancelLot(this.deps, _userId, userRole, lotId, userStaffRoles, cancelReason);
  }

  update(
    userRole: string,
    lotId: string,
    input: Partial<CreateLotInput>,
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    return updateLot(this.deps, userRole, lotId, input, userStaffRoles);
  }

  updateMarketingDetails(
    userRole: string,
    lotId: string,
    patch: UpdateLotMarketingDetailsInput,
    userStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    return updateLotMarketingDetails(this.deps, userRole, lotId, patch, userStaffRoles);
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
    viewerStaffRoles?: StaffRoles | undefined,
  ): Promise<{ data: (Lot | PublicLotView)[] }> {
    return listLotsForPublicApi(this.deps, filter, viewerRole, viewerStaffRoles);
  }

  bulkPublishOrCancel(
    userId: string,
    userRole: string,
    ids: string[],
    op: "publish" | "cancel",
    userStaffRoles?: StaffRoles | undefined,
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
    return bulkPublishOrCancel(this.deps, userId, userRole, ids, op, userStaffRoles, reason);
  }

  listBidsForPublicApi(input: {
    lotId: string;
    viewerRole: UserRole;
    viewerStaffRoles?: StaffRoles | undefined;
    viewerId: string | undefined;
    limitQuery: string | undefined;
  }): Promise<ListBidsForPublicApiResult> {
    return listBidsForPublicApi(this.deps, input);
  }

  listPublicBidHistory(input: {
    lotId: string;
    viewerId: string | undefined;
    limitQuery: string | undefined;
  }): Promise<{ kind: "ok"; data: PublicBidHistory } | { kind: "not_found" }> {
    return listPublicBidHistory(this.deps, input);
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
    adminStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    return approveWithdrawalRequest(this.deps, adminUserId, adminRole, lotId, adminStaffRoles);
  }

  declineWithdrawalRequest(
    adminUserId: string,
    adminRole: UserRole,
    lotId: string,
    reason: string,
    adminStaffRoles?: StaffRoles | undefined,
  ): Promise<Result<{ taskId: string }, LotError | AuthzError>> {
    return declineWithdrawalRequest(
      this.deps,
      adminUserId,
      adminRole,
      lotId,
      reason,
      adminStaffRoles,
    );
  }
}
