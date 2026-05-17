import type { Database } from "@auction/db";
import { adminReviewTask } from "@auction/db/schema";
import {
  type Bid,
  type CreateLotInput,
  type Lot,
  type UserRole,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import { englishOnlyAdminLotAuctionTypeViolation } from "@auction/validators";
import { and, eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { canManageCatalogue } from "../lib/catalogue-auth.js";
import { AuthzError, LotError, missingCatalogueCapabilityError } from "../lib/errors.js";
import { lotBidderRef } from "../lib/lot-bidder-ref.js";
import { maskLotForPublicView } from "../lib/lot-public-view.js";
import { presentLotsImages } from "../lib/media-presenters.js";
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
  ListLotsFilter,
} from "./interfaces/repositories.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";
import { resolveLegalEntityNotificationRecipients } from "./legal-entity-notification-routing.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";

const CANCELLABLE: ReadonlySet<Lot["status"]> = new Set(["draft", "scheduled", "active"]);

const SELLER_WITHDRAW_ROLES = new Set(["owner", "admin"]);

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
  englishOnlyAuctions?: boolean;
};

export class LotService {
  private readonly lotRepo: ILotRepository;
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
  private readonly mediaUrlResolver: MediaUrlResolver | undefined;
  private readonly englishOnlyAuctions: boolean;

  constructor(opts: LotServiceOptions) {
    this.lotRepo = opts.lotRepo;
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
    this.mediaUrlResolver = opts.mediaUrlResolver;
    this.englishOnlyAuctions = opts.englishOnlyAuctions ?? false;
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
    const created = await this.lotRepo.create(input);
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
    if (!roleHasCapability(role, "auction.manage", staff)) {
      return err(new AuthzError("Only staff with auction.manage can publish lots", 403));
    }
    const a = await this.lotRepo.findById(lotId);
    if (!a) return err(new LotError("Lot not found", 404));
    if (a.status !== "draft") {
      return err(new LotError("Only draft lots can be published"));
    }
    if (a.startTime.getTime() <= Date.now()) {
      return err(new LotError("startTime must be in the future to publish"));
    }
    if (
      this.enforceIndividualConnectOnPublish &&
      this.legalEntityRepository &&
      a.sellerLegalEntityId
    ) {
      const seller = await this.legalEntityRepository.findById(a.sellerLegalEntityId);
      if (seller?.kind === "individual") {
        const connectReady =
          seller.status === "approved" &&
          seller.stripeConnectChargesEnabled &&
          seller.stripeConnectPayoutsEnabled;
        if (!connectReady) {
          return err(
            new LotError(
              "This seller must complete Stripe Connect onboarding before the lot can be scheduled.",
              409,
              "connect_required",
            ),
          );
        }
      }
    }
    await this.lotRepo.updateStatus(lotId, "scheduled");
    const updated = await this.lotRepo.findById(lotId);
    if (!updated) return err(new LotError("Lot not found", 404));
    await this.jobScheduler?.scheduleLot(lotId, updated.startTime, updated.endTime);
    return ok(updated);
  }

  async cancel(
    _userId: string,
    userRole: string,
    lotId: string,
    userStaffRole?: string | null,
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
    await this.jobScheduler?.cancelLotJobs(lotId);
    await this.lotRepo.updateStatus(lotId, "cancelled");
    const updated = await this.lotRepo.findById(lotId);
    if (!updated) return err(new LotError("Lot not found", 404));

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

    if (a.status !== "draft") {
      if (input.images === undefined) {
        return err(new LotError("Only draft lots can be edited"));
      }
      const updated = await this.lotRepo.update(lotId, { images: input.images });
      await this.imageCleanup?.enqueueRemovedMany(a.images, input.images);
      return ok(updated);
    }
    const nextStart = input.startTime ?? a.startTime;
    const nextEnd = input.endTime ?? a.endTime;
    if (nextEnd <= nextStart) {
      return err(new LotError("endTime must be after startTime"));
    }
    const lockMsg = englishOnlyAdminLotAuctionTypeViolation({
      enabled: this.englishOnlyAuctions,
      existing: a.auctionType,
      ...(input.auctionType !== undefined ? { requested: input.auctionType } : {}),
    });
    if (lockMsg) {
      return err(new LotError(lockMsg));
    }
    const updated = await this.lotRepo.update(lotId, input);
    if (input.images !== undefined) {
      await this.imageCleanup?.enqueueRemovedMany(a.images, input.images);
    }
    return ok(updated);
  }

  async updateMarketingDetails(
    userRole: string,
    lotId: string,
    patch: UpdateLotMarketingDetailsInput,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    const role = normalizeUserRoleOrClient(userRole);
    const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
    if (!roleHasCapability(role, "auction.manage", staff)) {
      return err(
        new AuthzError("Only staff with auction.manage can update marketing details", 403),
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
    const rows = await this.lotRepo.list(filter);
    const presented = await presentLotsImages(this.mediaUrlResolver, rows);
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
  ): Promise<Result<{ attempted: number; failed: number; errors: string[] }, AuthzError>> {
    const role = normalizeUserRoleOrClient(userRole);
    const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
    if (!roleHasCapability(role, "auction.manage", staff)) {
      return err(new AuthzError("Forbidden", 403));
    }
    const errors: string[] = [];
    for (const id of ids) {
      if (op === "publish") {
        const res = await this.publish(userId, userRole, id, userStaffRole);
        if (res.isErr()) errors.push(`${id}: ${res.error.message}`);
      } else {
        const res = await this.cancel(userId, userRole, id, userStaffRole);
        if (res.isErr()) errors.push(`${id}: ${res.error.message}`);
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
    if (!db || !publisher || !legalEntityRepository) {
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
      await publisher.publish(tx, {
        aggregateType: "lot",
        aggregateId: lotId,
        eventType: "lot.withdrawal_requested",
        payload: { sellerLegalEntityId: sellerLegalEntityId },
        actorUserId: sellerUserId,
        actingLegalEntityId: sellerLegalEntityId,
      });
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
    const cancelRes = await this.cancel(adminUserId, adminRole, lotId, adminStaffRole);
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
