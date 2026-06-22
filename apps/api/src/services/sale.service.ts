import type { Database } from "@auction/db";
import {
  type CreateSaleInput,
  type Lot,
  type Sale,
  type UserRole,
  type Venue,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import type {
  CreateNestedLotForSaleInput,
  CreateSaleInput as ValidatorCreateSale,
} from "@auction/validators";
import {
  PUBLIC_LOT_STATUSES,
  englishOnlyAdminLotAuctionTypeViolation,
  formatPostalAddress,
  getSaleModeCapabilities,
  isOnsiteLocationPopulated,
  isPublicCatalogLot,
  isPublicCatalogSale,
  isStartInFutureForPublish,
  resolvePublicSaleListFilter,
  viewerCanSeeNonPublicCatalog,
} from "@auction/validators";
import type { updateSaleSchema } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { z } from "zod";
import type { LotAttachedToSalePayload } from "../domain/lot-events.js";
import { canManageCatalogue } from "../lib/catalogue-auth.js";
import { AuthzError, LotError, missingCatalogueCapabilityError } from "../lib/errors.js";
import { assertLotPublishable } from "../lib/lot-publish-policy.js";
import { lotTimingViolationForSale, resolveLotTimingForSale } from "../lib/lot-sale-timing.js";
import {
  rollbackSalePublishOnScheduleFailure,
  scheduleJobsFailedError,
} from "../lib/lot-schedule-jobs.js";
import {
  presentLotsImages,
  presentSaleAdminImages,
  presentSaleImages,
  presentSalesWithLotsImages,
} from "../lib/media-presenters.js";
import type { PlatformCatalogLegalEntityIdProvider } from "../lib/platform-catalog-legal-entity.js";
import { findLotsMissingSellerConnect } from "../lib/seller-connect-readiness.js";
import { DrizzleLotRepository } from "../repositories/drizzle-lot.repository.js";
import { DrizzleSaleRepository } from "../repositories/drizzle-sale.repository.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { ImageCleanupService } from "./image-cleanup.service.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import type { IVenueRepository } from "./interfaces/venue.js";
import type { LotLifecycleRecording } from "./lot-lifecycle-recording.service.js";
import type { MediaAssetEnricher } from "./media-asset-enricher.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import type { QrCodeService } from "./qr-code.service.js";

/** Optional follow state for public sale detail responses. */
export type SaleFollowReader = {
  isFollowing(userId: string, saleId: string): Promise<boolean>;
};

type UpdateSaleBody = z.infer<typeof updateSaleSchema>;

const SALE_CANCELLABLE: ReadonlySet<Sale["status"]> = new Set(["draft", "scheduled", "active"]);

export type SaleServiceOptions = {
  saleRepo: ISaleRepository;
  lotRepo: ILotRepository;
  jobScheduler: ILotJobScheduler | null;
  resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  imageCleanup?: ImageCleanupService;
  saleFollowReader?: SaleFollowReader | null;
  mediaUrlResolver?: MediaUrlResolver;
  catalogueMediaUrlResolver?: MediaUrlResolver;
  mediaAssetEnricher?: MediaAssetEnricher;
  englishOnlyAuctions?: boolean;
  db?: Database;
  domainEventPublisher?: DomainEventPublisher | null;
  lotLifecycleRecording?: LotLifecycleRecording | null;
  legalEntityRepository?: ILegalEntityRepository | null;
  venueRepository?: IVenueRepository | null;
  enforceIndividualConnectOnPublish?: boolean;
  qrCodeService?: QrCodeService | null;
};

export class SaleService {
  private readonly saleRepo: ISaleRepository;
  private readonly lotRepo: ILotRepository;
  private readonly jobScheduler: ILotJobScheduler | null;
  private readonly resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  private readonly imageCleanup: ImageCleanupService | undefined;
  private readonly saleFollowReader: SaleFollowReader | null;
  private readonly mediaUrlResolver: MediaUrlResolver | undefined;
  private readonly catalogueMediaUrlResolver: MediaUrlResolver | undefined;
  private readonly mediaAssetEnricher: MediaAssetEnricher | undefined;
  private readonly englishOnlyAuctions: boolean;
  private readonly db: Database | undefined;
  private readonly domainEventPublisher: DomainEventPublisher | null;
  private readonly lotLifecycleRecording: LotLifecycleRecording | null;
  private readonly legalEntityRepository: ILegalEntityRepository | null;
  private readonly venueRepository: IVenueRepository | null;
  private readonly enforceIndividualConnectOnPublish: boolean;
  private readonly qrCodeService: QrCodeService | null;

  constructor(opts: SaleServiceOptions) {
    this.saleRepo = opts.saleRepo;
    this.lotRepo = opts.lotRepo;
    this.jobScheduler = opts.jobScheduler;
    this.resolvePlatformCatalogLegalEntityId = opts.resolvePlatformCatalogLegalEntityId;
    this.imageCleanup = opts.imageCleanup;
    this.saleFollowReader = opts.saleFollowReader ?? null;
    this.mediaUrlResolver = opts.mediaUrlResolver;
    this.catalogueMediaUrlResolver = opts.catalogueMediaUrlResolver ?? opts.mediaUrlResolver;
    this.mediaAssetEnricher = opts.mediaAssetEnricher;
    this.englishOnlyAuctions = opts.englishOnlyAuctions ?? false;
    this.db = opts.db;
    this.domainEventPublisher = opts.domainEventPublisher ?? null;
    this.lotLifecycleRecording = opts.lotLifecycleRecording ?? null;
    this.legalEntityRepository = opts.legalEntityRepository ?? null;
    this.venueRepository = opts.venueRepository ?? null;
    this.enforceIndividualConnectOnPublish = opts.enforceIndividualConnectOnPublish ?? false;
    this.qrCodeService = opts.qrCodeService ?? null;
  }

  private async recordLotLifecycle(fn: (tx: Database) => Promise<void>): Promise<void> {
    if (!this.db || !this.lotLifecycleRecording) return;
    await this.db.transaction(fn);
  }

  private async publishSaleEvent(
    actorUserId: string,
    saleId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.db || !this.domainEventPublisher) return;
    await this.domainEventPublisher.publish(this.db, {
      aggregateType: "sale",
      aggregateId: saleId,
      eventType,
      payload,
      actorUserId,
    });
  }

  private venueLocationSnapshot(venue: Venue): Partial<CreateSaleInput> {
    const locationAddressLine1 = venue.addressLine1;
    const locationAddressLine2 = venue.addressLine2;
    const locationCity = venue.city;
    const locationCounty = venue.county;
    const locationPostcode = venue.postcode;
    const locationCountry = venue.country;
    const locationAddress = formatPostalAddress({
      locationAddressLine1,
      locationAddressLine2,
      locationCity,
      locationCounty,
      locationPostcode,
      locationCountry,
    });
    return {
      venueId: venue.id,
      locationName: venue.name,
      locationAddress: locationAddress || null,
      locationMapUrl: venue.mapUrl,
      locationAddressLine1,
      locationAddressLine2,
      locationCity,
      locationCounty,
      locationPostcode,
      locationCountry,
    };
  }

  private async applyVenueSnapshot(
    input: Partial<CreateSaleInput>,
    options: {
      saleLegalEntityId: string;
      existingVenueId?: string | null;
      snapshotAddress: boolean;
    },
  ): Promise<Result<Partial<CreateSaleInput>, LotError>> {
    const venueId = input.venueId !== undefined ? input.venueId : options.existingVenueId;
    if (!venueId) return ok(input);
    if (!this.venueRepository) {
      return err(new LotError("Venue repository is not configured", 500));
    }
    const venue = await this.venueRepository.findById(venueId);
    if (!venue) return err(new LotError("Venue not found", 404, "venue_not_found"));
    if (venue.legalEntityId !== options.saleLegalEntityId) {
      return err(
        new LotError("Venue does not belong to this organisation", 403, "venue_org_mismatch"),
      );
    }
    if (venue.status !== "active") {
      return err(
        new LotError("Archived venues cannot be assigned to sales", 409, "venue_archived"),
      );
    }
    if (!options.snapshotAddress) {
      return ok({ ...input, venueId });
    }
    return ok({ ...input, ...this.venueLocationSnapshot(venue) });
  }

  async create(adminId: string, input: ValidatorCreateSale): Promise<Sale> {
    if (input.endTime <= input.startTime) {
      throw new LotError("endTime must be after startTime");
    }
    const createdByLegalEntityId = await this.resolvePlatformCatalogLegalEntityId();
    if (!createdByLegalEntityId) {
      throw new LotError(
        "Platform catalog legal entity is not configured. Reseed the dev database (pnpm --filter @auction/db db:seed:dev) and restart the API.",
        400,
      );
    }
    const snapshot = await this.applyVenueSnapshot(input, {
      saleLegalEntityId: createdByLegalEntityId,
      snapshotAddress: false,
    });
    if (snapshot.isErr()) throw snapshot.error;
    const normalizedInput = { ...input, ...snapshot.value };
    const sale = await this.saleRepo.create({ ...normalizedInput, createdByLegalEntityId });
    await this.qrCodeService?.getOrCreateDefault({
      entityType: "sale",
      entityId: sale.id,
      actorUserId: adminId,
    });
    if (input.lots?.length) {
      for (const row of input.lots) {
        const lockMsg = englishOnlyAdminLotAuctionTypeViolation({
          enabled: this.englishOnlyAuctions,
          requested: row.auctionType,
        });
        if (lockMsg) {
          throw new LotError(lockMsg);
        }
        const { sellerId, ...lotFields } = row;
        const resolved = resolveLotTimingForSale(sale, lotFields.startTime, lotFields.endTime);
        if (!resolved.ok) {
          throw new LotError(resolved.message, 400);
        }
        if (this.db && this.lotLifecycleRecording) {
          const created = await this.db.transaction(async (tx) => {
            const lotRepo = new DrizzleLotRepository(tx);
            const created = await lotRepo.create({
              ...lotFields,
              sellerLegalEntityId: sellerId,
              startTime: resolved.startTime,
              endTime: resolved.endTime,
              saleId: sale.id,
            });
            await this.lotLifecycleRecording?.recordCreated(tx, {
              lot: created,
              source: "sale_create",
            });
            return created;
          });
          await this.qrCodeService?.getOrCreateDefault({
            entityType: "lot",
            entityId: created.id,
            actorUserId: adminId,
          });
        } else {
          const created = await this.lotRepo.create({
            ...lotFields,
            sellerLegalEntityId: sellerId,
            startTime: resolved.startTime,
            endTime: resolved.endTime,
            saleId: sale.id,
          });
          await this.recordLotLifecycle(async (tx) => {
            await this.lotLifecycleRecording?.recordCreated(tx, {
              lot: created,
              source: "sale_create",
            });
          });
          await this.qrCodeService?.getOrCreateDefault({
            entityType: "lot",
            entityId: created.id,
            actorUserId: adminId,
          });
        }
      }
    }
    await this.publishSaleEvent(adminId, sale.id, "sale.created", {
      from_status: null,
      to_status: sale.status,
      deliveryMode: sale.deliveryMode,
      lotCount: input.lots?.length ?? 0,
    });
    return sale;
  }

  async getByIdWithLots(id: string): Promise<{ sale: Sale; lots: Lot[] } | null> {
    const sale = await this.saleRepo.findById(id);
    if (!sale) return null;
    const lots = await this.lotRepo.findBySaleId(id);
    return { sale, lots };
  }

  /** Staff catalogue edit: raw storage keys plus parallel resolved URLs for thumbnails. */
  async getSaleDetailForCatalogAdmin(saleId: string): Promise<{
    data: { sale: Awaited<ReturnType<typeof presentSaleAdminImages>>; lots: Lot[] };
  } | null> {
    const bundle = await this.getByIdWithLots(saleId);
    if (!bundle) return null;
    const sale = await presentSaleAdminImages(
      this.mediaUrlResolver,
      bundle.sale,
      this.mediaAssetEnricher,
    );
    const lots = await presentLotsImages(
      this.mediaUrlResolver,
      bundle.lots,
      this.mediaAssetEnricher,
    );
    return { data: { sale, lots } };
  }

  /** Public sale detail: bundle, follow flag, resolved media URLs. */
  async getSaleDetailForPublicApi(
    saleId: string,
    viewerUserId: string | undefined,
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<{ data: { sale: Sale; lots: Lot[]; viewer: { isFollowing: boolean } } } | null> {
    const bundle = await this.getByIdWithLots(saleId);
    if (!bundle) return null;

    const canPreview = viewerCanSeeNonPublicCatalog(viewer?.role, viewer?.staffRole);
    if (!canPreview && !isPublicCatalogSale(bundle.sale)) return null;

    const isFollowing =
      viewerUserId && this.saleFollowReader
        ? await this.saleFollowReader.isFollowing(viewerUserId, saleId)
        : false;
    const [sale, lots] = await Promise.all([
      presentSaleImages(this.mediaUrlResolver, bundle.sale, this.mediaAssetEnricher),
      presentLotsImages(this.mediaUrlResolver, bundle.lots, this.mediaAssetEnricher),
    ]);
    const visibleLots = canPreview
      ? lots
      : lots.filter((lot) => isPublicCatalogLot(lot, bundle.sale));
    return { data: { sale, lots: visibleLots, viewer: { isFollowing } } };
  }

  async listSalesForPublicApi(
    filter: Parameters<ISaleRepository["list"]>[0],
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<{ data: { sale: Sale; lots: Lot[] }[] }> {
    const canPreview = viewerCanSeeNonPublicCatalog(viewer?.role, viewer?.staffRole);
    const resolved = resolvePublicSaleListFilter({
      status: filter.status,
      statuses: filter.statuses,
      viewerCanSeeNonPublic: canPreview,
    });
    const queryFilter = {
      ...filter,
      ...(resolved.statuses !== undefined
        ? { statuses: resolved.statuses, status: undefined }
        : resolved.status !== undefined
          ? { status: resolved.status, statuses: undefined }
          : {}),
    };
    const rows = await this.list(queryFilter);
    const data = await presentSalesWithLotsImages(
      this.catalogueMediaUrlResolver,
      rows,
      this.mediaAssetEnricher,
    );
    if (canPreview) return { data };
    return {
      data: data
        .filter(({ sale }) => isPublicCatalogSale(sale))
        .map(({ sale, lots }) => ({
          sale,
          lots: lots.filter((lot) => isPublicCatalogLot(lot, sale)),
        })),
    };
  }

  async listSaleLotsPageForPublicApi(
    saleId: string,
    opts: { limit: number; offset: number; sort?: "lot" | "priceAsc" | "priceDesc" | "endingAsc" },
    viewer?: { role?: string | undefined; staffRole?: string | null | undefined },
  ): Promise<{
    data: {
      items: Lot[];
      total: number;
      limit: number;
      offset: number;
      sort: typeof opts.sort;
    };
  } | null> {
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return null;

    const canPreview = viewerCanSeeNonPublicCatalog(viewer?.role, viewer?.staffRole);
    if (!canPreview && !isPublicCatalogSale(sale)) return null;

    const page = await this.lotRepo.listCatalogLotsBySalePage({
      saleId,
      sort: opts.sort ?? "lot",
      limit: opts.limit,
      offset: opts.offset,
      ...(canPreview
        ? {}
        : {
            lotStatuses: [...PUBLIC_LOT_STATUSES],
            requirePublicSale: true,
          }),
    });
    const items = await presentLotsImages(
      this.mediaUrlResolver,
      page.items,
      this.mediaAssetEnricher,
    );
    return {
      data: {
        items,
        total: page.total,
        limit: opts.limit,
        offset: opts.offset,
        sort: opts.sort,
      },
    };
  }

  /** Paginated lots for a sale; used by the saleroom catalog (server-side pagination). */
  async listLotsPage(
    saleId: string,
    opts: { limit: number; offset: number; sort?: "lot" | "priceAsc" | "priceDesc" | "endingAsc" },
  ): Promise<{ items: Lot[]; total: number } | null> {
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return null;
    return this.lotRepo.listCatalogLotsBySalePage({
      saleId,
      sort: opts.sort ?? "lot",
      limit: opts.limit,
      offset: opts.offset,
    });
  }

  async list(
    filter: Parameters<ISaleRepository["list"]>[0],
  ): Promise<{ sale: Sale; lots: Lot[] }[]> {
    const sales = await this.saleRepo.list(filter);
    if (sales.length === 0) return [];
    const allLots = await this.lotRepo.findBySaleIds(sales.map((s) => s.id));
    const bySale = new Map<string, Lot[]>();
    for (const l of allLots) {
      if (!l.saleId) continue;
      const arr = bySale.get(l.saleId) ?? [];
      arr.push(l);
      bySale.set(l.saleId, arr);
    }
    return sales.map((s) => ({ sale: s, lots: bySale.get(s.id) ?? [] }));
  }

  async publish(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<{ sale: Sale; lots: Lot[] }, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can publish sales", 403));
    }
    const bundle = await this.getByIdWithLots(saleId);
    if (!bundle) return err(new LotError("Sale not found", 404));
    let { sale, lots } = bundle;
    if (sale.status !== "draft") {
      return err(new LotError("Only draft sales can be published"));
    }
    if (!isStartInFutureForPublish(sale.startTime)) {
      return err(new LotError("startTime must be in the future to publish"));
    }
    if (lots.length === 0) {
      return err(new LotError("Sale must have at least one lot to publish"));
    }
    const caps = getSaleModeCapabilities(sale.deliveryMode);
    if (caps.allowsLocation && sale.venueId) {
      const saleLegalEntityId =
        sale.createdByLegalEntityId ?? (await this.resolvePlatformCatalogLegalEntityId());
      if (!saleLegalEntityId) {
        return err(new LotError("Sale legal entity is not configured", 400));
      }
      const snapshot = await this.applyVenueSnapshot(
        { venueId: sale.venueId },
        {
          saleLegalEntityId,
          existingVenueId: sale.venueId,
          snapshotAddress: true,
        },
      );
      if (snapshot.isErr()) return err(snapshot.error);
      sale = await this.saleRepo.update(saleId, snapshot.value);
      lots = await this.lotRepo.findBySaleId(saleId);
    }
    if (caps.allowsLocation && !isOnsiteLocationPopulated(sale)) {
      return err(
        new LotError(
          "Onsite sales require a saved venue or venue name with address before publish",
          400,
          "onsite_location_required",
        ),
      );
    }
    for (const l of lots) {
      if (l.status !== "draft") {
        return err(new LotError("All lots in the sale must be draft to publish"));
      }
      const publishable = assertLotPublishable(l, {
        sale,
        requireCatalogue: true,
        rejectDraftSale: false,
      });
      if (!publishable.ok) {
        const error = publishable.error;
        return err(new LotError(`${error.message} (lot "${l.title}")`, error.status, error.code));
      }
    }

    if (this.enforceIndividualConnectOnPublish && this.legalEntityRepository) {
      const blocked = await findLotsMissingSellerConnect(lots, this.legalEntityRepository);
      if (blocked.length > 0) {
        const titles = blocked.map((l) => `"${l.title}"`).join(", ");
        return err(
          new LotError(
            blocked.length === 1
              ? `This seller must complete Stripe Connect onboarding before the lot can be scheduled. (lot ${titles})`
              : `Sellers must complete Stripe Connect onboarding before publish (${blocked.length} lots: ${titles})`,
            409,
            "connect_required",
          ),
        );
      }
    }

    if (this.db && this.lotLifecycleRecording) {
      await this.db.transaction(async (tx) => {
        const saleRepo = new DrizzleSaleRepository(tx);
        const lotRepo = new DrizzleLotRepository(tx);
        if (caps.inheritsLotTiming) {
          for (const l of lots) {
            const resolved = resolveLotTimingForSale(sale, l.startTime, l.endTime);
            if (
              resolved.ok &&
              (resolved.startTime.getTime() !== l.startTime.getTime() ||
                resolved.endTime.getTime() !== l.endTime.getTime())
            ) {
              await lotRepo.update(l.id, {
                startTime: resolved.startTime,
                endTime: resolved.endTime,
              });
            }
          }
        }
        await saleRepo.updateStatus(saleId, "scheduled");
        for (const l of lots) {
          await lotRepo.updateStatus(l.id, "scheduled");
          const row = await lotRepo.findById(l.id);
          if (!row) throw new LotError("Lot not found", 404);
          await this.lotLifecycleRecording?.recordPublished(tx, row, userId);
        }
      });
    } else {
      if (caps.inheritsLotTiming) {
        for (const l of lots) {
          const resolved = resolveLotTimingForSale(sale, l.startTime, l.endTime);
          if (
            resolved.ok &&
            (resolved.startTime.getTime() !== l.startTime.getTime() ||
              resolved.endTime.getTime() !== l.endTime.getTime())
          ) {
            await this.lotRepo.update(l.id, {
              startTime: resolved.startTime,
              endTime: resolved.endTime,
            });
          }
        }
      }
      await this.saleRepo.updateStatus(saleId, "scheduled");
      for (const l of lots) {
        await this.lotRepo.updateStatus(l.id, "scheduled");
        await this.recordLotLifecycle(async (tx) => {
          await this.lotLifecycleRecording?.recordPublished(
            tx,
            { ...l, status: "scheduled" },
            userId,
          );
        });
      }
    }
    const scheduledLotIds: string[] = [];
    for (const l of lots) {
      const lotStart = caps.inheritsLotTiming ? sale.startTime : l.startTime;
      const lotEnd = caps.inheritsLotTiming ? sale.endTime : l.endTime;
      try {
        await this.jobScheduler?.scheduleLot(l.id, lotStart, lotEnd);
        scheduledLotIds.push(l.id);
      } catch {
        await rollbackSalePublishOnScheduleFailure({
          jobScheduler: this.jobScheduler,
          lotRepo: this.lotRepo,
          saleRepo: this.saleRepo,
          lotLifecycleRecording: this.lotLifecycleRecording,
          db: this.db ?? null,
          recordLotLifecycle: (fn) => this.recordLotLifecycle(fn),
          saleId,
          lots,
          scheduledLotIds,
          actorUserId: userId,
        });
        return err(scheduleJobsFailedError());
      }
    }
    const updatedSale = await this.saleRepo.findById(saleId);
    if (!updatedSale) return err(new LotError("Sale not found", 404));
    const updatedLots = await this.lotRepo.findBySaleId(saleId);
    await this.publishSaleEvent(userId, saleId, "sale.published", {
      from_status: "draft",
      to_status: "scheduled",
      lotCount: updatedLots.length,
      deliveryMode: updatedSale.deliveryMode,
    });
    return ok({ sale: updatedSale, lots: updatedLots });
  }

  /** Revert a scheduled sale (and its scheduled lots) back to draft.
   *  Guard: only allowed when the sale is `scheduled` and all lots are still `scheduled`
   *  (i.e. no lot has gone active or ended yet — meaning no bids have been placed). */
  async unpublish(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<Sale, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can unpublish sales", 403));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    if (sale.status !== "scheduled") {
      return err(
        new LotError("Only scheduled sales can be reverted to draft (no active or ended sales)"),
      );
    }
    const lots = await this.lotRepo.findBySaleId(saleId);
    const hasStartedLot = lots.some((l) => l.status !== "scheduled" && l.status !== "draft");
    if (hasStartedLot) {
      return err(
        new LotError(
          "Cannot revert to draft: at least one lot is active, ended, or cancelled. Cancel the sale instead.",
        ),
      );
    }
    for (const l of lots) {
      await this.jobScheduler?.cancelLotJobs(l.id);
    }
    if (this.db && this.lotLifecycleRecording) {
      await this.db.transaction(async (tx) => {
        const lotRepo = new DrizzleLotRepository(tx);
        const saleRepo = new DrizzleSaleRepository(tx);
        for (const l of lots) {
          await lotRepo.updateStatus(l.id, "draft");
          const row = await lotRepo.findById(l.id);
          if (!row) throw new LotError("Lot not found", 404);
          await this.lotLifecycleRecording?.recordUnpublished(tx, row, "sale_unpublish", userId);
        }
        await saleRepo.updateStatus(saleId, "draft");
      });
    } else {
      for (const l of lots) {
        await this.lotRepo.updateStatus(l.id, "draft");
        await this.recordLotLifecycle(async (tx) => {
          await this.lotLifecycleRecording?.recordUnpublished(tx, l, "sale_unpublish", userId);
        });
      }
      await this.saleRepo.updateStatus(saleId, "draft");
    }
    const updated = await this.saleRepo.findById(saleId);
    if (!updated) return err(new LotError("Sale not found", 404));
    await this.publishSaleEvent(userId, saleId, "sale.unpublished", {
      from_status: "scheduled",
      to_status: "draft",
    });
    return ok(updated);
  }

  async cancel(
    userId: string,
    userRole: string,
    saleId: string,
    userStaffRole?: string | null,
  ): Promise<Result<Sale, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can cancel sales", 403));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    if (!SALE_CANCELLABLE.has(sale.status)) {
      return err(new LotError("This sale cannot be cancelled"));
    }
    const lots = await this.lotRepo.findBySaleId(saleId);
    for (const l of lots) {
      if (l.status === "draft" || l.status === "scheduled" || l.status === "active") {
        await this.jobScheduler?.cancelLotJobs(l.id);
      }
    }
    if (this.db && this.lotLifecycleRecording) {
      await this.db.transaction(async (tx) => {
        const lotRepo = new DrizzleLotRepository(tx);
        const saleRepo = new DrizzleSaleRepository(tx);
        for (const l of lots) {
          if (l.status === "draft" || l.status === "scheduled" || l.status === "active") {
            await lotRepo.updateStatus(l.id, "cancelled");
            const row = await lotRepo.findById(l.id);
            if (!row) throw new LotError("Lot not found", 404);
            await this.lotLifecycleRecording?.recordCancelled(tx, row, "sale_cancel", userId);
          }
        }
        await saleRepo.updateStatus(saleId, "cancelled");
      });
    } else {
      for (const l of lots) {
        if (l.status === "draft" || l.status === "scheduled" || l.status === "active") {
          await this.lotRepo.updateStatus(l.id, "cancelled");
          await this.recordLotLifecycle(async (tx) => {
            await this.lotLifecycleRecording?.recordCancelled(
              tx,
              { ...l, status: "cancelled" },
              "sale_cancel",
              userId,
            );
          });
        }
      }
      await this.saleRepo.updateStatus(saleId, "cancelled");
    }
    const updated = await this.saleRepo.findById(saleId);
    if (!updated) return err(new LotError("Sale not found", 404));
    await this.publishSaleEvent(userId, saleId, "sale.cancelled", {
      from_status: sale.status,
      to_status: "cancelled",
      lotCount: lots.length,
    });
    return ok(updated);
  }

  async addLot(
    userRole: string,
    saleId: string,
    row: CreateNestedLotForSaleInput,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    const role = normalizeUserRoleOrClient(userRole);
    const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
    if (!canManageCatalogue(role, staff)) {
      return err(
        missingCatalogueCapabilityError(
          "Only staff with auction.manage or catalogue.write can add lots to a sale",
          role,
          staff,
        ),
      );
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    if (sale.status !== "draft") {
      return err(new LotError("Lots can only be added while the sale is draft"));
    }
    const { sellerId, ...lotFields } = row;
    const resolved = resolveLotTimingForSale(sale, lotFields.startTime, lotFields.endTime);
    if (!resolved.ok) {
      return err(new LotError(resolved.message, 400));
    }
    if (resolved.endTime <= resolved.startTime) {
      return err(new LotError("endTime must be after startTime"));
    }
    const lockMsg = englishOnlyAdminLotAuctionTypeViolation({
      enabled: this.englishOnlyAuctions,
      requested: row.auctionType,
    });
    if (lockMsg) {
      return err(new LotError(lockMsg));
    }
    let created: Lot;
    if (this.db && this.lotLifecycleRecording) {
      created = await this.db.transaction(async (tx) => {
        const lotRepo = new DrizzleLotRepository(tx);
        const row = await lotRepo.create({
          ...lotFields,
          sellerLegalEntityId: sellerId,
          startTime: resolved.startTime,
          endTime: resolved.endTime,
          saleId,
        });
        await this.lotLifecycleRecording?.recordCreated(tx, {
          lot: row,
          source: "sale_create",
        });
        return row;
      });
    } else {
      created = await this.lotRepo.create({
        ...lotFields,
        sellerLegalEntityId: sellerId,
        startTime: resolved.startTime,
        endTime: resolved.endTime,
        saleId,
      });
      await this.recordLotLifecycle(async (tx) => {
        await this.lotLifecycleRecording?.recordCreated(tx, {
          lot: created,
          source: "sale_create",
        });
      });
    }
    return ok(created);
  }

  async attachExistingLot(
    userRole: string,
    saleId: string,
    lotId: string,
    userStaffRole?: string | null,
    attachVia: LotAttachedToSalePayload["via"] = "attach_endpoint",
  ): Promise<Result<Lot, LotError | AuthzError>> {
    const role = normalizeUserRoleOrClient(userRole);
    const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
    if (!canManageCatalogue(role, staff)) {
      return err(
        missingCatalogueCapabilityError(
          "Only staff with auction.manage or catalogue.write can attach lots",
          role,
          staff,
        ),
      );
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    if (sale.status !== "draft") {
      return err(new LotError("Lots can only be attached while the sale is draft"));
    }
    const existingLot = await this.lotRepo.findById(lotId);
    if (!existingLot) return err(new LotError("Lot not found", 404));
    if (existingLot.status !== "draft") {
      return err(new LotError("Only draft standalone lots can be attached"));
    }
    if (existingLot.saleId != null) {
      return err(new LotError("Lot already belongs to a sale"));
    }
    const inSale = await this.lotRepo.findBySaleId(saleId);
    const maxNum = inSale.reduce((m, l) => Math.max(m, l.lotNumber ?? 0), 0);
    const lotNumber = maxNum + 1;
    const resolved = resolveLotTimingForSale(sale, existingLot.startTime, existingLot.endTime);
    if (!resolved.ok) {
      return err(new LotError(resolved.message, 400));
    }
    let updated: Lot;
    if (this.db && this.lotLifecycleRecording) {
      updated = await this.db.transaction(async (tx) => {
        const lotRepo = new DrizzleLotRepository(tx);
        const row = await lotRepo.update(lotId, {
          saleId,
          lotNumber,
          startTime: resolved.startTime,
          endTime: resolved.endTime,
        });
        await this.lotLifecycleRecording?.recordAttached(tx, existingLot, {
          saleId,
          lotNumber,
          fromSaleId: null,
          via: attachVia,
        });
        return row;
      });
    } else {
      updated = await this.lotRepo.update(lotId, {
        saleId,
        lotNumber,
        startTime: resolved.startTime,
        endTime: resolved.endTime,
      });
      await this.recordLotLifecycle(async (tx) => {
        await this.lotLifecycleRecording?.recordAttached(tx, existingLot, {
          saleId,
          lotNumber,
          fromSaleId: null,
          via: attachVia,
        });
      });
    }
    return ok(updated);
  }

  async detachLot(
    userRole: string,
    saleId: string,
    lotId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, LotError | AuthzError>> {
    const role = normalizeUserRoleOrClient(userRole);
    const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
    if (!canManageCatalogue(role, staff)) {
      return err(
        missingCatalogueCapabilityError(
          "Only staff with auction.manage or catalogue.write can detach lots",
          role,
          staff,
        ),
      );
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    if (sale.status !== "draft") {
      return err(new LotError("Lots can only be detached while the sale is draft"));
    }
    const l = await this.lotRepo.findById(lotId);
    if (!l || l.saleId !== saleId) {
      return err(new LotError("Lot not found in this sale", 404));
    }
    if (l.status !== "draft") {
      return err(new LotError("Only draft lots can be moved between sales"));
    }
    const fromSaleId = l.saleId;
    if (this.db && this.lotLifecycleRecording) {
      await this.db.transaction(async (tx) => {
        const lotRepo = new DrizzleLotRepository(tx);
        await lotRepo.clearSaleId(lotId);
        await this.lotLifecycleRecording?.recordDetached(tx, l, fromSaleId);
      });
    } else {
      await this.lotRepo.clearSaleId(lotId);
      await this.recordLotLifecycle(async (tx) => {
        await this.lotLifecycleRecording?.recordDetached(tx, l, fromSaleId);
      });
    }
    return ok(undefined);
  }

  async updateDraft(
    userRole: string,
    saleId: string,
    patch: UpdateSaleBody,
    userStaffRole?: string | null,
  ): Promise<Result<Sale, LotError | AuthzError>> {
    const role = userRole as UserRole;
    const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
    if (!canManageCatalogue(role, staff)) {
      return err(
        missingCatalogueCapabilityError(
          "Only staff with auction.manage or catalogue.write can edit sales",
          role,
          staff,
        ),
      );
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));

    if (sale.status !== "draft") {
      const publishedPatch: Partial<CreateSaleInput> = {};
      if (patch.coverImages !== undefined) publishedPatch.coverImages = patch.coverImages;
      if (patch.title !== undefined) publishedPatch.title = patch.title;
      if (patch.description !== undefined) publishedPatch.description = patch.description;
      const caps = getSaleModeCapabilities(sale.deliveryMode);
      const canEditStreamUrl =
        caps.allowsStreamUrl &&
        (sale.status === "scheduled" || sale.status === "active") &&
        patch.streamUrl !== undefined;
      if (canEditStreamUrl) {
        publishedPatch.streamUrl = patch.streamUrl ?? null;
      }
      // Auction-day media: only allowed for ended onsite/hybrid sales.
      const dayImagesRequested = patch.dayImages !== undefined;
      if (dayImagesRequested) {
        if (!caps.allowsLocation) {
          return err(
            new LotError("Auction day media is only supported for onsite and hybrid sales", 422),
          );
        }
        if (sale.status !== "ended") {
          return err(
            new LotError("Auction day media can only be saved after the sale has ended", 422),
          );
        }
        publishedPatch.dayImages = patch.dayImages;
      }
      if (Object.keys(publishedPatch).length === 0) {
        return err(new LotError("Only draft sales can be edited"));
      }
      const updated = await this.saleRepo.update(saleId, publishedPatch);
      if (patch.coverImages !== undefined) {
        await this.imageCleanup?.enqueueRemovedMany(sale.coverImages, patch.coverImages);
      }
      if (dayImagesRequested && patch.dayImages !== undefined) {
        // Collect all keys (video poster keys too) for cleanup.
        const prevKeys = (sale.dayImages ?? []).flatMap((r) => {
          const keys = [r.key];
          if (r.mediaType === "video" && "posterKey" in r && r.posterKey) keys.push(r.posterKey);
          return keys;
        });
        const nextKeys = patch.dayImages.flatMap((r) => {
          const keys = [r.key];
          if (r.mediaType === "video" && "posterKey" in r && r.posterKey) keys.push(r.posterKey);
          return keys;
        });
        await this.imageCleanup?.enqueueRemovedMany(prevKeys, nextKeys);
      }
      return ok(updated);
    }
    const nextStart = patch.startTime ?? sale.startTime;
    const nextEnd = patch.endTime ?? sale.endTime;
    if (nextEnd <= nextStart) {
      return err(new LotError("endTime must be after startTime"));
    }
    let normalized: Partial<CreateSaleInput> = { ...(patch as Partial<CreateSaleInput>) };
    const nextDelivery = patch.deliveryMode ?? sale.deliveryMode;
    const caps = getSaleModeCapabilities(nextDelivery);
    if (!caps.allowsStreamUrl) {
      normalized.streamUrl = null;
    }
    if (!caps.allowsLocation) {
      normalized.locationName = null;
      normalized.locationAddress = null;
      normalized.locationMapUrl = null;
      normalized.locationAddressLine1 = null;
      normalized.locationAddressLine2 = null;
      normalized.locationCity = null;
      normalized.locationCounty = null;
      normalized.locationPostcode = null;
      normalized.locationCountry = null;
      normalized.venueId = null;
    } else {
      const saleLegalEntityId =
        sale.createdByLegalEntityId ?? (await this.resolvePlatformCatalogLegalEntityId());
      if (!saleLegalEntityId) {
        return err(new LotError("Sale legal entity is not configured", 400));
      }
      const snapshot = await this.applyVenueSnapshot(normalized, {
        saleLegalEntityId,
        existingVenueId: sale.venueId ?? null,
        snapshotAddress: false,
      });
      if (snapshot.isErr()) return err(snapshot.error);
      normalized = snapshot.value;
    }
    if (caps.inheritsLotTiming) {
      const lots = await this.lotRepo.findBySaleId(saleId);
      const syncDraftLots = async (lotRepo: ILotRepository) => {
        for (const l of lots) {
          if (l.status === "draft") {
            await lotRepo.update(l.id, { startTime: nextStart, endTime: nextEnd });
          }
        }
      };
      if (this.db) {
        const updated = await this.db.transaction(async (tx) => {
          const lotRepo = new DrizzleLotRepository(tx);
          const saleRepo = new DrizzleSaleRepository(tx);
          await syncDraftLots(lotRepo);
          return saleRepo.update(saleId, normalized);
        });
        if (patch.coverImages !== undefined) {
          await this.imageCleanup?.enqueueRemovedMany(sale.coverImages, patch.coverImages);
        }
        return ok(updated);
      }
      await syncDraftLots(this.lotRepo);
    } else if (patch.startTime !== undefined || patch.endTime !== undefined) {
      const lots = await this.lotRepo.findBySaleId(saleId);
      const nextSale = {
        ...sale,
        deliveryMode: nextDelivery,
        startTime: nextStart,
        endTime: nextEnd,
      };
      const violations: string[] = [];
      for (const l of lots) {
        const violation = lotTimingViolationForSale(nextSale, l.startTime, l.endTime);
        if (violation) {
          violations.push(`${violation} (lot "${l.title}")`);
        }
      }
      if (violations.length > 0) {
        return err(new LotError(violations.join("; "), 400));
      }
    }
    const updated = await this.saleRepo.update(saleId, normalized);
    if (patch.coverImages !== undefined) {
      await this.imageCleanup?.enqueueRemovedMany(sale.coverImages, patch.coverImages);
    }
    if (normalized.dayImages !== undefined) {
      const prevKeys = (sale.dayImages ?? []).flatMap((r) => {
        const keys = [r.key];
        if (r.mediaType === "video" && "posterKey" in r && r.posterKey) keys.push(r.posterKey);
        return keys;
      });
      const nextKeys = normalized.dayImages.flatMap((r) => {
        const keys = [r.key];
        if (r.mediaType === "video" && "posterKey" in r && r.posterKey) keys.push(r.posterKey);
        return keys;
      });
      await this.imageCleanup?.enqueueRemovedMany(prevKeys, nextKeys);
    }
    return ok(updated);
  }

  /** Read sale by id for joins (e.g. portfolio pricing). Resolves cover image URLs when configured. */
  async getById(id: string): Promise<Sale | null> {
    const row = await this.saleRepo.findById(id);
    if (!row) return null;
    return presentSaleImages(this.mediaUrlResolver, row, this.mediaAssetEnricher);
  }

  /** Batch read by ids — single DB round trip for portfolio / lot-list pricing joins. */
  async findByIds(ids: string[]): Promise<Sale[]> {
    if (ids.length === 0) return [];
    const rows = await this.saleRepo.findByIds(ids);
    return Promise.all(
      rows.map((r) => presentSaleImages(this.mediaUrlResolver, r, this.mediaAssetEnricher)),
    );
  }
}
