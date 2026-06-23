import type { Database } from "@auction/db";
import { adminReviewTask } from "@auction/db/schema";
import {
  type Bid,
  type CreateLotInput,
  type Lot,
  type Sale,
  type UserRole,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import {
  englishOnlyAdminLotAuctionTypeViolation,
  isStartInFutureForPublish,
  resolvePublicLotListFilter,
  viewerCanSeeNonPublicCatalog,
} from "@auction/validators";
import { and, eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import type { LotCancelledPayload } from "../domain/lot-events.js";
import { canManageCatalogue } from "../lib/catalogue-auth.js";
import {
  emergencyAddPublishFailedError,
  resolveLotNumberForEmergencyAdd,
  rollbackFailedEmergencyLotAdd,
} from "../lib/emergency-lot-add.js";
import { AuthzError, LotError, missingCatalogueCapabilityError } from "../lib/errors.js";
import { lotBidderRef } from "../lib/lot-bidder-ref.js";
import { maskLotForPublicView } from "../lib/lot-public-view.js";
import { assertLotPublishable } from "../lib/lot-publish-policy.js";
import { mergeSaleTimingIntoPatch, resolveLotTimingForSale } from "../lib/lot-sale-timing.js";
import { scheduleLotWithDraftRollback } from "../lib/lot-schedule-jobs.js";
import { presentLotsImages } from "../lib/media-presenters.js";
import { findPostgresError } from "../lib/pg-error.js";
import { publishSingleLot } from "../lib/publish-single-lot.js";
import { findLotsMissingSellerConnect } from "../lib/seller-connect-readiness.js";
import { DrizzleLotRepository } from "../repositories/drizzle-lot.repository.js";
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
import type { ITelephoneBidBookingService } from "./interfaces/telephone-bid-booking-service.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";
import { resolveLegalEntityNotificationRecipients } from "./legal-entity-notification-routing.js";
import type { LotLifecycleRecording } from "./lot-lifecycle-recording.service.js";
import type { LotTransitionOrchestrator } from "./lot-transition-orchestrator.js";
import type { MediaAssetEnricher } from "./media-asset-enricher.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import type { QrCodeService } from "./qr-code.service.js";

const CANCELLABLE: ReadonlySet<Lot["status"]> = new Set(["draft", "scheduled", "active"]);

const SALE_STATUSES_ALLOWING_LOT_ADD: ReadonlySet<Sale["status"]> = new Set([
  "draft",
  "scheduled",
  "active",
]);

const SELLER_WITHDRAW_ROLES = new Set(["owner", "admin"]);

const LOT_NUMBER_CONFLICT_MSG =
  "Lot number already used in that sale — pick a different number or leave it blank to auto-assign.";

function lotNumberConflictError(): LotError {
  return new LotError(LOT_NUMBER_CONFLICT_MSG, 400);
}

function lotNumberTakenInSale(lots: Lot[], lotNumber: number, excludeLotId: string): boolean {
  return lots.some((l) => l.id !== excludeLotId && l.lotNumber === lotNumber);
}

function nextLotNumberInSale(lots: Lot[], excludeLotId: string): number {
  const maxNum = lots
    .filter((l) => l.id !== excludeLotId)
    .reduce((m, l) => Math.max(m, l.lotNumber ?? 0), 0);
  return maxNum + 1;
}

function mapLotNumberConstraintError(error: unknown): LotError | null {
  const pg = findPostgresError(error);
  if (
    pg?.code === "23505" &&
    (pg.message.includes("lot_sale_id_lot_number") ||
      pg.message.includes("lot_sale_id_lot_number_uid"))
  ) {
    return lotNumberConflictError();
  }
  return null;
}

/** @deprecated use {@link mapLotNumberConstraintError} — kept for call-sites in update path */
const mapLotUpdateDbError = mapLotNumberConstraintError;

export type LotBidPublicApiRow = Omit<Bid, "placedByUserId"> & {
  bidderRef: string;
  placedByUserId: string | null;
};

export type ListBidsForPublicApiResult =
  | { kind: "not_found" }
  | { kind: "ok"; data: LotBidPublicApiRow[] };

function clampLotBidsLimitQuery(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "50", 10);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 50;
}

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
};

export class LotService {
  private readonly lotRepo: ILotRepository;
  private readonly saleRepo: ISaleRepository | null;
  private readonly bids: IBidRepository;
  private readonly watchlist: IWatchlistRepository;
  private readonly jobScheduler: ILotJobScheduler | null;
  private readonly lotNotifications: ILotNotificationCoordinator | null;
  private readonly imageCleanup: ImageCleanupService | undefined;
  private readonly legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader | null;
  private readonly legalEntityRepository: ILegalEntityRepository | null;
  private readonly enforceIndividualConnectOnPublish: boolean;
  private readonly db: Database | null;
  private readonly domainEventPublisher: DomainEventPublisher | null;
  private readonly catalogueMediaUrlResolver: MediaUrlResolver | undefined;
  private readonly mediaAssetEnricher: MediaAssetEnricher | undefined;
  private readonly englishOnlyAuctions: boolean;
  private readonly lotLifecycleRecording: LotLifecycleRecording | null;
  private readonly _lotTransitionOrchestrator: LotTransitionOrchestrator | null;
  private readonly qrCodeService: QrCodeService | null;
  private readonly telephoneBidBookingService: ITelephoneBidBookingService | null;

  constructor(opts: LotServiceOptions) {
    this.lotRepo = opts.lotRepo;
    this.saleRepo = opts.saleRepo ?? null;
    this.bids = opts.bids;
    this.watchlist = opts.watchlist;
    this.jobScheduler = opts.jobScheduler;
    this.lotNotifications = opts.lotNotifications;
    this.imageCleanup = opts.imageCleanup;
    this.legalEntityNotificationRecipients = opts.legalEntityNotificationRecipients ?? null;
    this.legalEntityRepository = opts.legalEntityRepository ?? null;
    this.enforceIndividualConnectOnPublish = opts.enforceIndividualConnectOnPublish ?? false;
    this.db = opts.db ?? null;
    this.domainEventPublisher = opts.domainEventPublisher ?? null;
    this.catalogueMediaUrlResolver = opts.catalogueMediaUrlResolver ?? opts.mediaUrlResolver;
    this.mediaAssetEnricher = opts.mediaAssetEnricher;
    this.englishOnlyAuctions = opts.englishOnlyAuctions ?? false;
    this.lotLifecycleRecording = opts.lotLifecycleRecording ?? null;
    this._lotTransitionOrchestrator = opts.lotTransitionOrchestrator ?? null;
    this.qrCodeService = opts.qrCodeService ?? null;
    this.telephoneBidBookingService = opts.telephoneBidBookingService ?? null;
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

  private publishSingleLotDeps() {
    return {
      lotRepo: this.lotRepo,
      jobScheduler: this.jobScheduler,
      lotLifecycleRecording: this.lotLifecycleRecording,
      db: this.db ?? null,
      recordLotLifecycle: (fn: (tx: Database) => Promise<void>) => this.recordLifecycle(fn),
      legalEntityRepository: this.legalEntityRepository,
      enforceIndividualConnectOnPublish: this.enforceIndividualConnectOnPublish,
    };
  }

  private async recordLifecycle(
    fn: (tx: NonNullable<LotServiceOptions["db"]>) => Promise<void>,
  ): Promise<void> {
    if (!this.db || !this.lotLifecycleRecording) return;
    await this.db.transaction(async (tx) => fn(tx));
  }

  async create(_sellerId: string, input: CreateLotInput): Promise<Result<Lot, LotError>> {
    if (input.endTime <= input.startTime) {
      return err(new LotError("endTime must be after startTime"));
    }
    const lockMsg = englishOnlyAdminLotAuctionTypeViolation({
      enabled: this.englishOnlyAuctions,
      requested: input.auctionType,
    });
    if (lockMsg) {
      return err(new LotError(lockMsg));
    }
    const timingResult = await this.applySaleTimingPolicyToInput(input.saleId ?? null, input);
    if (timingResult.isErr()) {
      return err(timingResult.error);
    }
    const { input: timedInput, sale: saleForPublish } = timingResult.value;
    const createdSource =
      saleForPublish && saleForPublish.status !== "draft"
        ? ("emergency_add" as const)
        : ("staff_create" as const);
    let createPayload = timedInput;
    if (saleForPublish && saleForPublish.status !== "draft") {
      const inSaleLots = await this.lotRepo.findBySaleId(saleForPublish.id);
      const lotNumber = resolveLotNumberForEmergencyAdd({
        sale: saleForPublish,
        requestedLotNumber: createPayload.lotNumber,
        inSaleLots,
      });
      if (lotNumber !== undefined) {
        createPayload = { ...createPayload, lotNumber };
      }
    }
    if (this.db && this.lotLifecycleRecording) {
      let created: Lot;
      try {
        created = await this.db.transaction(async (tx) => {
          const lotRepo = new DrizzleLotRepository(tx);
          const row = await lotRepo.create(createPayload);
          await this.lotLifecycleRecording?.recordCreated(tx, {
            lot: row,
            source: createdSource,
          });
          return row;
        });
      } catch (e) {
        const mapped = mapLotNumberConstraintError(e);
        if (mapped) return err(mapped);
        throw e;
      }
      await this.qrCodeService?.getOrCreateDefault({
        entityType: "lot",
        entityId: created.id,
      });
      if (saleForPublish && saleForPublish.status !== "draft") {
        const published = await publishSingleLot(
          { lot: created, sale: saleForPublish },
          this.publishSingleLotDeps(),
        );
        if (published.isErr()) {
          await rollbackFailedEmergencyLotAdd(created, this.publishSingleLotDeps());
          return err(emergencyAddPublishFailedError(published.error, created.id, true));
        }
        return ok(published.value);
      }
      return ok(created);
    }
    let created: Lot;
    try {
      created = await this.lotRepo.create(createPayload);
    } catch (e) {
      const mapped = mapLotNumberConstraintError(e);
      if (mapped) return err(mapped);
      throw e;
    }
    await this.recordLifecycle(async (tx) => {
      await this.lotLifecycleRecording?.recordCreated(tx, {
        lot: created,
        source: createdSource,
      });
    });
    await this.qrCodeService?.getOrCreateDefault({
      entityType: "lot",
      entityId: created.id,
    });
    if (saleForPublish && saleForPublish.status !== "draft") {
      const published = await publishSingleLot(
        { lot: created, sale: saleForPublish },
        this.publishSingleLotDeps(),
      );
      if (published.isErr()) {
        await rollbackFailedEmergencyLotAdd(created, this.publishSingleLotDeps());
        return err(emergencyAddPublishFailedError(published.error, created.id, true));
      }
      return ok(published.value);
    }
    return ok(created);
  }

  async publish(
    _userId: string,
    userRole: string,
    lotId: string,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    const role = normalizeUserRoleOrClient(userRole);
    const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
    if (!canManageCatalogue(role, staff)) {
      return err(
        missingCatalogueCapabilityError(
          "Only staff with auction.manage or catalogue.write can publish lots",
          role,
          staff,
        ),
      );
    }
    const a = await this.lotRepo.findById(lotId);
    if (!a) return err(new LotError("Lot not found", 404));

    let saleForPublish: Sale | null = null;
    if (a.saleId) {
      if (!this.saleRepo) {
        return err(new LotError("Sale repository not configured", 500));
      }
      const sale = await this.saleRepo.findById(a.saleId);
      if (!sale) return err(new LotError("Sale not found", 404));
      saleForPublish = sale;
    }

    const publishable = assertLotPublishable(a, { sale: saleForPublish, requireCatalogue: true });
    if (!publishable.ok) {
      return err(publishable.error);
    }
    const alignedPatch = publishable.timing.alignedPatch;
    if (this.enforceIndividualConnectOnPublish && this.legalEntityRepository) {
      const blocked = await findLotsMissingSellerConnect([a], this.legalEntityRepository);
      if (blocked.length > 0) {
        return err(
          new LotError(
            "This seller must complete Stripe Connect onboarding before the lot can be scheduled.",
            409,
            "connect_required",
          ),
        );
      }
    }
    let updated: Lot;
    if (this.db && this.lotLifecycleRecording) {
      updated = await this.db.transaction(async (tx) => {
        const lotRepo = new DrizzleLotRepository(tx);
        if (alignedPatch) {
          await lotRepo.update(lotId, alignedPatch);
        }
        await lotRepo.updateStatus(lotId, "scheduled");
        const row = await lotRepo.findById(lotId);
        if (!row) throw new LotError("Lot not found", 404);
        await this.lotLifecycleRecording?.recordPublished(tx, row, _userId);
        return row;
      });
    } else {
      if (alignedPatch) {
        await this.lotRepo.update(lotId, alignedPatch);
      }
      await this.lotRepo.updateStatus(lotId, "scheduled");
      const row = await this.lotRepo.findById(lotId);
      if (!row) return err(new LotError("Lot not found", 404));
      updated = row;
      await this.recordLifecycle(async (tx) => {
        await this.lotLifecycleRecording?.recordPublished(tx, updated, _userId);
      });
    }
    const scheduleResult = await scheduleLotWithDraftRollback({
      jobScheduler: this.jobScheduler,
      lotRepo: this.lotRepo,
      lotLifecycleRecording: this.lotLifecycleRecording,
      db: this.db ?? null,
      recordLotLifecycle: (fn) => this.recordLifecycle(fn),
      lotId,
      startTime: updated.startTime,
      endTime: updated.endTime,
      actorUserId: _userId,
      unpublishReason: "manual",
    });
    if (scheduleResult.isErr()) return err(scheduleResult.error);
    return ok(updated);
  }

  async cancel(
    _userId: string,
    userRole: string,
    lotId: string,
    userStaffRole?: string | null,
    cancelReason: LotCancelledPayload["reason"] = "manual",
  ): Promise<Result<Lot, LotError | AuthzError>> {
    const a = await this.lotRepo.findById(lotId);
    if (!a) return err(new LotError("Lot not found", 404));
    const role = normalizeUserRoleOrClient(userRole);
    const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
    if (!roleHasCapability(role, "auction.manage", staff)) {
      return err(new AuthzError("Only staff with auction.manage can cancel lots", 403));
    }
    if (!CANCELLABLE.has(a.status)) {
      return err(new LotError("This lot cannot be cancelled"));
    }
    let updated: Lot;
    if (this.db && this.lotLifecycleRecording) {
      updated = await this.db.transaction(async (tx) => {
        const lotRepo = new DrizzleLotRepository(tx);
        await lotRepo.updateStatus(lotId, "cancelled");
        const row = await lotRepo.findById(lotId);
        if (!row) throw new LotError("Lot not found", 404);
        await this.lotLifecycleRecording?.recordCancelled(tx, row, cancelReason, _userId);
        return row;
      });
    } else {
      await this.lotRepo.updateStatus(lotId, "cancelled");
      const row = await this.lotRepo.findById(lotId);
      if (!row) return err(new LotError("Lot not found", 404));
      updated = row;
      await this.recordLifecycle(async (tx) => {
        await this.lotLifecycleRecording?.recordCancelled(tx, updated, cancelReason, _userId);
      });
    }
    await this.jobScheduler?.cancelLotJobs(lotId);

    if (updated.saleId && this.telephoneBidBookingService) {
      await this.telephoneBidBookingService.removeLotFromActiveBookings(updated.saleId, lotId);
    }

    if (this.lotNotifications) {
      const bidders = await this.bids.listDistinctBidderIds(lotId);
      const watchers = await this.watchlist.listUserIdsForLot(lotId);
      const sellerRecipients = await resolveLegalEntityNotificationRecipients(
        this.legalEntityNotificationRecipients,
        {
          legalEntityId: a.sellerLegalEntityId,
          fallbackUserId: _userId,
          audience: "seller",
        },
      );
      const recipientIds = [...new Set<string>([...bidders, ...watchers, ...sellerRecipients])];
      await this.lotNotifications.notifyLotCancelled({
        lotId,
        title: a.title,
        recipientIds,
      });
    }

    return ok(updated);
  }

  async update(
    userRole: string,
    lotId: string,
    input: Partial<CreateLotInput>,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    const role = normalizeUserRoleOrClient(userRole);
    const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
    if (!canManageCatalogue(role, staff)) {
      return err(
        missingCatalogueCapabilityError(
          "Only staff with auction.manage or catalogue.write can edit lots",
          role,
          staff,
        ),
      );
    }
    const a = await this.lotRepo.findById(lotId);
    if (!a) return err(new LotError("Lot not found", 404));

    if (a.status === "ended" || a.status === "cancelled" || a.status === "voided") {
      return err(new LotError("This lot cannot be edited"));
    }

    if (a.status === "active") {
      if (input.images === undefined) {
        return err(new LotError("Only images can be edited on an active lot"));
      }
      const updated = await this.lotRepo.update(lotId, { images: input.images });
      await this.imageCleanup?.enqueueRemovedMany(a.images, input.images);
      return ok(updated);
    }

    const lockMsg = englishOnlyAdminLotAuctionTypeViolation({
      enabled: this.englishOnlyAuctions,
      existing: a.auctionType,
      ...(input.auctionType !== undefined ? { requested: input.auctionType } : {}),
    });
    if (lockMsg) {
      return err(new LotError(lockMsg));
    }
    const patchResult = await this.prepareSaleAssignmentPatch(lotId, a, input);
    if (patchResult.isErr()) {
      return err(patchResult.error);
    }
    const timingPatchResult = await this.applySaleTimingPolicyToLot(a, patchResult.value);
    if (timingPatchResult.isErr()) {
      return err(timingPatchResult.error);
    }
    const patch = timingPatchResult.value;
    const nextStart = patch.startTime ?? a.startTime;
    const nextEnd = patch.endTime ?? a.endTime;
    if (nextEnd <= nextStart) {
      return err(new LotError("endTime must be after startTime"));
    }
    if (
      a.status === "scheduled" &&
      (patch.startTime !== undefined || patch.endTime !== undefined) &&
      !isStartInFutureForPublish(nextStart)
    ) {
      return err(new LotError("startTime must be in the future for scheduled lots"));
    }
    let updated: Lot;
    try {
      if (
        patch.saleId !== undefined &&
        patch.saleId !== a.saleId &&
        this.db &&
        this.lotLifecycleRecording
      ) {
        updated = await this.db.transaction(async (tx) => {
          const lotRepo = new DrizzleLotRepository(tx);
          const row = await lotRepo.update(lotId, patch);
          if (a.saleId && patch.saleId !== a.saleId) {
            await this.lotLifecycleRecording?.recordDetached(tx, a, a.saleId);
          }
          if (patch.saleId) {
            await this.lotLifecycleRecording?.recordAttached(tx, row, {
              saleId: patch.saleId,
              lotNumber: row.lotNumber,
              fromSaleId: a.saleId,
              via: "patch",
            });
          }
          return row;
        });
      } else {
        updated = await this.lotRepo.update(lotId, patch);
        if (patch.saleId !== undefined && patch.saleId !== a.saleId) {
          await this.recordLifecycle(async (tx) => {
            if (a.saleId && patch.saleId !== a.saleId) {
              await this.lotLifecycleRecording?.recordDetached(tx, a, a.saleId);
            }
            if (patch.saleId) {
              await this.lotLifecycleRecording?.recordAttached(tx, updated, {
                saleId: patch.saleId,
                lotNumber: updated.lotNumber,
                fromSaleId: a.saleId,
                via: "patch",
              });
            }
          });
        }
      }
    } catch (error) {
      const mapped = mapLotUpdateDbError(error);
      if (mapped) {
        return err(mapped);
      }
      throw error;
    }
    if (patch.images !== undefined) {
      await this.imageCleanup?.enqueueRemovedMany(a.images, patch.images);
    }
    if (a.status === "scheduled" && this.jobScheduler) {
      const timesChanged =
        nextStart.getTime() !== a.startTime.getTime() || nextEnd.getTime() !== a.endTime.getTime();
      if (timesChanged) {
        await this.jobScheduler.cancelLotJobs(lotId);
        await this.jobScheduler.scheduleLot(lotId, nextStart, nextEnd);
      }
    }
    return ok(updated);
  }

  private async prepareSaleAssignmentPatch(
    lotId: string,
    lot: Lot,
    input: Partial<CreateLotInput>,
  ): Promise<Result<Partial<CreateLotInput>, LotError>> {
    const patch: Partial<CreateLotInput> = { ...input };

    if (input.saleId === undefined) {
      if (input.lotNumber !== undefined && input.lotNumber !== null && lot.saleId != null) {
        const inSale = await this.lotRepo.findBySaleId(lot.saleId);
        if (lotNumberTakenInSale(inSale, input.lotNumber, lotId)) {
          return err(lotNumberConflictError());
        }
      }
      return ok(patch);
    }

    if (input.saleId === lot.saleId) {
      if (input.lotNumber !== undefined && input.lotNumber !== null && input.saleId != null) {
        const inSale = await this.lotRepo.findBySaleId(input.saleId);
        if (lotNumberTakenInSale(inSale, input.lotNumber, lotId)) {
          return err(lotNumberConflictError());
        }
      }
      return ok(patch);
    }

    if (input.saleId === null) {
      if (lot.saleId != null) {
        if (!this.saleRepo) {
          return err(new LotError("Sale repository not configured", 500));
        }
        const sourceSale = await this.saleRepo.findById(lot.saleId);
        if (!sourceSale) {
          return err(new LotError("Sale not found", 404));
        }
        if (sourceSale.status !== "draft") {
          return err(new LotError("Lots can only be detached while the sale is draft"));
        }
        if (lot.status !== "draft") {
          return err(new LotError("Only draft lots can be moved between sales"));
        }
      }
      patch.lotNumber = null;
      return ok(patch);
    }

    if (!this.saleRepo) {
      return err(new LotError("Sale repository not configured", 500));
    }

    const sale = await this.saleRepo.findById(input.saleId);
    if (!sale) {
      return err(new LotError("Sale not found", 404));
    }
    if (sale.status !== "draft") {
      return err(new LotError("Lots can only be attached while the sale is draft"));
    }
    if (input.saleId !== lot.saleId && lot.status !== "draft") {
      return err(new LotError("Only draft lots can be moved between sales"));
    }
    if (lot.saleId != null && lot.saleId !== input.saleId) {
      const sourceSale = await this.saleRepo.findById(lot.saleId);
      if (!sourceSale) {
        return err(new LotError("Sale not found", 404));
      }
      if (sourceSale.status !== "draft") {
        return err(new LotError("Lots can only be detached while the sale is draft"));
      }
    }

    const inSale = await this.lotRepo.findBySaleId(input.saleId);
    const requestedNumber =
      input.lotNumber !== undefined && input.lotNumber !== null ? input.lotNumber : undefined;

    if (requestedNumber !== undefined) {
      if (lotNumberTakenInSale(inSale, requestedNumber, lotId)) {
        return err(lotNumberConflictError());
      }
      patch.lotNumber = requestedNumber;
    } else {
      patch.lotNumber = nextLotNumberInSale(inSale, lotId);
    }

    return ok(patch);
  }

  private async applySaleTimingPolicyToInput(
    saleId: string | null,
    input: Pick<CreateLotInput, "startTime" | "endTime"> & Partial<CreateLotInput>,
  ): Promise<
    Result<{ input: CreateLotInput; sale: import("@auction/types").Sale | null }, LotError>
  > {
    if (saleId == null) {
      return ok({ input: input as CreateLotInput, sale: null });
    }
    if (!this.saleRepo) {
      return err(new LotError("Sale repository not configured", 500));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) {
      return err(new LotError("Sale not found", 404));
    }
    if (!SALE_STATUSES_ALLOWING_LOT_ADD.has(sale.status)) {
      return err(new LotError("Lots can only be added while the sale is draft"));
    }
    const resolved = resolveLotTimingForSale(sale, input.startTime, input.endTime);
    if (!resolved.ok) {
      return err(new LotError(resolved.message, 400));
    }
    return ok({
      input: {
        ...(input as CreateLotInput),
        startTime: resolved.startTime,
        endTime: resolved.endTime,
      },
      sale,
    });
  }

  private async applySaleTimingPolicyToLot(
    lot: Lot,
    patch: Partial<CreateLotInput>,
  ): Promise<Result<Partial<CreateLotInput>, LotError>> {
    const saleId = patch.saleId !== undefined ? patch.saleId : lot.saleId;
    if (saleId == null) {
      return ok(patch);
    }
    if (!this.saleRepo) {
      return err(new LotError("Sale repository not configured", 500));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) {
      return err(new LotError("Sale not found", 404));
    }
    const lotStart = patch.startTime ?? lot.startTime;
    const lotEnd = patch.endTime ?? lot.endTime;
    const resolved = resolveLotTimingForSale(sale, lotStart, lotEnd);
    if (!resolved.ok) {
      return err(new LotError(resolved.message, 400));
    }
    return ok(mergeSaleTimingIntoPatch(sale, lot, patch, resolved));
  }

  async updateMarketingDetails(
    userRole: string,
    lotId: string,
    patch: UpdateLotMarketingDetailsInput,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    const role = normalizeUserRoleOrClient(userRole);
    const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
    if (!canManageCatalogue(role, staff)) {
      return err(
        missingCatalogueCapabilityError(
          "Only staff with auction.manage or catalogue.write can update marketing details",
          role,
          staff,
        ),
      );
    }
    const a = await this.lotRepo.findById(lotId);
    if (!a) return err(new LotError("Lot not found", 404));
    if (a.status === "cancelled" || a.status === "ended") {
      return err(new LotError("Cannot update marketing details for this lot", 400));
    }
    const updated = await this.lotRepo.updateMarketingDetails(lotId, patch);
    return ok(updated);
  }

  async getById(id: string): Promise<Lot | null> {
    return this.lotRepo.findById(id);
  }

  async list(filter: ListLotsFilter): Promise<Lot[]> {
    return this.lotRepo.list(filter);
  }

  /** Public lot listing: list, resolve media URLs, apply role-based field masking. */
  async listLotsForPublicApi(
    filter: ListLotsFilter,
    viewerRole: string | undefined,
    viewerStaffRole?: string | null,
  ): Promise<{ data: Lot[] }> {
    const viewerCanSeeNonPublic = viewerCanSeeNonPublicCatalog(viewerRole, viewerStaffRole);
    const resolved = resolvePublicLotListFilter({
      status: filter.status,
      statuses: filter.statuses,
      viewerCanSeeNonPublic,
    });
    const queryFilter: ListLotsFilter = {
      ...filter,
      ...(resolved.statuses !== undefined
        ? { statuses: resolved.statuses, status: undefined }
        : resolved.status !== undefined
          ? { status: resolved.status, statuses: undefined }
          : {}),
      ...(!viewerCanSeeNonPublic ? { requirePublicParentSale: true } : {}),
    };

    if (!viewerCanSeeNonPublic && !this.saleRepo && process.env.NODE_ENV !== "test") {
      console.warn(
        "[listLotsForPublicApi] saleRepo unavailable; requirePublicParentSale relies on SQL only",
      );
    }

    const rows = await this.lotRepo.list(queryFilter);

    const resolveImages = filter.resolveImages !== false;
    const presented = resolveImages
      ? await presentLotsImages(this.catalogueMediaUrlResolver, rows, this.mediaAssetEnricher)
      : rows;
    return {
      data: presented.map((lotRow) => maskLotForPublicView(lotRow, viewerRole, viewerStaffRole)),
    };
  }

  async bulkPublishOrCancel(
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
    const role = normalizeUserRoleOrClient(userRole);
    const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
    if (op === "cancel") {
      if (!roleHasCapability(role, "auction.manage", staff)) {
        return err(new AuthzError("Only staff with auction.manage can bulk cancel lots", 403));
      }
    } else if (!canManageCatalogue(role, staff)) {
      return err(
        missingCatalogueCapabilityError(
          "Only staff with auction.manage or catalogue.write can run bulk lot actions",
          role,
          staff,
        ),
      );
    }
    const errors: Array<{ lotId: string; message: string; code?: string }> = [];
    const cancelReason =
      op === "cancel" && reason?.trim() ? ("admin_override" as const) : ("manual" as const);
    for (const id of ids) {
      if (op === "publish") {
        const res = await this.publish(userId, userRole, id, userStaffRole);
        if (res.isErr()) {
          const error = res.error;
          errors.push({
            lotId: id,
            message: error.message,
            ...(error instanceof LotError && error.code ? { code: error.code } : {}),
          });
        }
      } else {
        const res = await this.cancel(userId, userRole, id, userStaffRole, cancelReason);
        if (res.isErr()) {
          const error = res.error;
          errors.push({
            lotId: id,
            message: error.message,
            ...(error instanceof LotError && error.code ? { code: error.code } : {}),
          });
        }
      }
    }
    return ok({ attempted: ids.length, failed: errors.length, errors });
  }

  /**
   * Buyer-facing bid history for a lot: sealed-lot privacy gate, stable bidder refs,
   * and placedByUserId visibility rules.
   */
  async listBidsForPublicApi(input: {
    lotId: string;
    viewerRole: UserRole;
    viewerStaffRole?: string | null;
    viewerId: string | undefined;
    limitQuery: string | undefined;
  }): Promise<ListBidsForPublicApiResult> {
    const { lotId, viewerRole, viewerStaffRole, viewerId, limitQuery } = input;
    const vStaff = normalizeUserStaffRole(viewerStaffRole ?? undefined);
    const lot = await this.lotRepo.findById(lotId);
    if (!lot) {
      return { kind: "not_found" };
    }
    if (lot.auctionType === "sealed" && lot.status === "active") {
      if (!roleHasCapability(viewerRole, "auction.manage", vStaff)) {
        return { kind: "ok", data: [] };
      }
    }
    const limit = clampLotBidsLimitQuery(limitQuery);
    const bids = await this.bids.listForLot(lotId, limit);
    const canSeeBidderIds = roleHasCapability(viewerRole, "auction.manage", vStaff);
    const data: LotBidPublicApiRow[] = bids.map((bid) => {
      const isOwnBid = Boolean(viewerId && bid.placedByUserId === viewerId);
      const placedByUserIdForRef = bid.placedByUserId ?? "unknown";
      return {
        ...bid,
        bidderRef: lotBidderRef(lotId, placedByUserIdForRef),
        placedByUserId: canSeeBidderIds || isOwnBid ? (bid.placedByUserId ?? null) : null,
      };
    });
    return { kind: "ok", data };
  }

  /** Public watcher count for a lot (social proof on the marketing PDP / live feed). */
  async countWatchersForPublicApi(
    lotId: string,
  ): Promise<{ kind: "ok"; count: number } | { kind: "not_found" }> {
    const lot = await this.lotRepo.findById(lotId);
    if (!lot) {
      return { kind: "not_found" };
    }
    const count = await this.watchlist.countForLot(lotId);
    return { kind: "ok", count };
  }

  countMatching(filter: Omit<ListLotsFilter, "limit" | "offset" | "sort">): Promise<number> {
    return this.lotRepo.countMatching(filter);
  }

  archiveEndedSummary(filter: ArchiveEndedAggregateFilter) {
    return this.lotRepo.sumEndedHammer(filter);
  }

  /** Seller requests withdrawal; creates an admin review task (no lot state change). */
  async requestWithdrawal(
    sellerUserId: string,
    lotId: string,
  ): Promise<Result<{ taskId: string; alreadyPending: boolean }, LotError | AuthzError>> {
    const db = this.db;
    const publisher = this.domainEventPublisher;
    const legalEntityRepository = this.legalEntityRepository;
    if (!db || !legalEntityRepository || (!this.lotLifecycleRecording && !publisher)) {
      return err(new LotError("Withdrawal requests are not available", 503));
    }
    const lotRow = await this.lotRepo.findById(lotId);
    if (!lotRow) return err(new LotError("Lot not found", 404));
    if (!lotRow.sellerLegalEntityId) {
      return err(new LotError("Lot has no seller organisation", 400));
    }
    const sellerLegalEntityId = lotRow.sellerLegalEntityId;
    if (!CANCELLABLE.has(lotRow.status)) {
      return err(new LotError("This lot cannot be withdrawn in its current state", 409));
    }
    const membership = await legalEntityRepository.findActiveMembership(
      sellerUserId,
      sellerLegalEntityId,
    );
    if (!membership || !SELLER_WITHDRAW_ROLES.has(membership.role)) {
      return err(new AuthzError("Only seller organisation admins can request withdrawal", 403));
    }

    const existing = await db
      .select({ id: adminReviewTask.id })
      .from(adminReviewTask)
      .where(
        and(
          eq(adminReviewTask.targetLotId, lotId),
          eq(adminReviewTask.kind, "lot_withdrawal_request"),
          eq(adminReviewTask.status, "pending"),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return ok({ taskId: existing[0].id, alreadyPending: true });
    }

    const taskId = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(adminReviewTask)
        .values({
          kind: "lot_withdrawal_request",
          status: "pending",
          targetLotId: lotId,
          payload: { requestedByUserId: sellerUserId },
        })
        .returning({ id: adminReviewTask.id });
      if (!row) throw new Error("admin_review_task_insert_failed");
      if (this.lotLifecycleRecording) {
        await this.lotLifecycleRecording.recordWithdrawalRequested(
          tx,
          lotRow,
          sellerLegalEntityId,
          sellerUserId,
        );
      } else if (publisher) {
        await publisher.publish(tx, {
          aggregateType: "lot",
          aggregateId: lotId,
          eventType: "lot.withdrawal_requested",
          payload: { sellerLegalEntityId: sellerLegalEntityId },
          actorUserId: sellerUserId,
          actingLegalEntityId: sellerLegalEntityId,
        });
      }
      return row.id;
    });

    return ok({ taskId, alreadyPending: false });
  }

  /** Admin approves a pending seller withdrawal — cancels the lot and resolves the task. */
  async approveWithdrawalRequest(
    adminUserId: string,
    adminRole: UserRole,
    lotId: string,
    adminStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (!this.db) {
      return err(new LotError("Withdrawal approvals are not available", 503));
    }
    const role = normalizeUserRoleOrClient(adminRole);
    const staff = normalizeUserStaffRole(adminStaffRole ?? undefined);
    if (!roleHasCapability(role, "auction.manage", staff)) {
      return err(new AuthzError("Only staff with auction.manage can approve withdrawals", 403));
    }
    const pending = await this.db
      .select({ id: adminReviewTask.id })
      .from(adminReviewTask)
      .where(
        and(
          eq(adminReviewTask.targetLotId, lotId),
          eq(adminReviewTask.kind, "lot_withdrawal_request"),
          eq(adminReviewTask.status, "pending"),
        ),
      )
      .limit(1);
    if (!pending[0]) {
      return err(new LotError("No pending withdrawal request for this lot", 404));
    }
    const cancelRes = await this.cancel(
      adminUserId,
      adminRole,
      lotId,
      adminStaffRole,
      "withdrawal",
    );
    if (cancelRes.isErr()) return cancelRes;
    await this.db
      .update(adminReviewTask)
      .set({
        status: "resolved",
        resolvedByUserId: adminUserId,
        resolvedAt: new Date(),
        resolutionNotes: "Seller withdrawal approved; lot cancelled.",
      })
      .where(eq(adminReviewTask.id, pending[0].id));
    return cancelRes;
  }
}
