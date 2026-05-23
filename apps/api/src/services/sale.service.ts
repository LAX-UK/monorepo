import {
  type CreateSaleInput,
  type Lot,
  type Sale,
  type UserRole,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import type {
  CreateNestedLotForSaleInput,
  CreateSaleInput as ValidatorCreateSale,
} from "@auction/validators";
import {
  englishOnlyAdminLotAuctionTypeViolation,
  getSaleModeCapabilities,
} from "@auction/validators";
import type { updateSaleSchema } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { z } from "zod";
import { canManageCatalogue } from "../lib/catalogue-auth.js";
import { AuthzError, LotError, missingCatalogueCapabilityError } from "../lib/errors.js";
import { lotTimingViolationForSale, resolveLotTimingForSale } from "../lib/lot-sale-timing.js";
import {
  presentLotsImages,
  presentSaleAdminImages,
  presentSaleImages,
  presentSalesWithLotsImages,
} from "../lib/media-presenters.js";
import type { PlatformCatalogLegalEntityIdProvider } from "../lib/platform-catalog-legal-entity.js";
import type { ImageCleanupService } from "./image-cleanup.service.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";

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
  englishOnlyAuctions?: boolean;
};

export class SaleService {
  private readonly saleRepo: ISaleRepository;
  private readonly lotRepo: ILotRepository;
  private readonly jobScheduler: ILotJobScheduler | null;
  private readonly resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  private readonly imageCleanup: ImageCleanupService | undefined;
  private readonly saleFollowReader: SaleFollowReader | null;
  private readonly mediaUrlResolver: MediaUrlResolver | undefined;
  private readonly englishOnlyAuctions: boolean;

  constructor(opts: SaleServiceOptions) {
    this.saleRepo = opts.saleRepo;
    this.lotRepo = opts.lotRepo;
    this.jobScheduler = opts.jobScheduler;
    this.resolvePlatformCatalogLegalEntityId = opts.resolvePlatformCatalogLegalEntityId;
    this.imageCleanup = opts.imageCleanup;
    this.saleFollowReader = opts.saleFollowReader ?? null;
    this.mediaUrlResolver = opts.mediaUrlResolver;
    this.englishOnlyAuctions = opts.englishOnlyAuctions ?? false;
  }

  async create(_adminId: string, input: ValidatorCreateSale): Promise<Sale> {
    if (input.endTime <= input.startTime) {
      throw new LotError("endTime must be after startTime");
    }
    const createdByLegalEntityId = await this.resolvePlatformCatalogLegalEntityId();
    if (!createdByLegalEntityId) {
      throw new LotError("Platform catalog legal entity is not configured. Contact support.", 400);
    }
    const sale = await this.saleRepo.create({ ...input, createdByLegalEntityId });
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
        await this.lotRepo.create({
          ...lotFields,
          sellerLegalEntityId: sellerId,
          startTime: resolved.startTime,
          endTime: resolved.endTime,
          saleId: sale.id,
        });
      }
    }
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
    const sale = await presentSaleAdminImages(this.mediaUrlResolver, bundle.sale);
    const lots = await presentLotsImages(this.mediaUrlResolver, bundle.lots);
    return { data: { sale, lots } };
  }

  /** Public sale detail: bundle, follow flag, resolved media URLs. */
  async getSaleDetailForPublicApi(
    saleId: string,
    viewerUserId: string | undefined,
  ): Promise<{ data: { sale: Sale; lots: Lot[]; viewer: { isFollowing: boolean } } } | null> {
    const bundle = await this.getByIdWithLots(saleId);
    if (!bundle) return null;
    const isFollowing =
      viewerUserId && this.saleFollowReader
        ? await this.saleFollowReader.isFollowing(viewerUserId, saleId)
        : false;
    const [sale, lots] = await Promise.all([
      presentSaleImages(this.mediaUrlResolver, bundle.sale),
      presentLotsImages(this.mediaUrlResolver, bundle.lots),
    ]);
    return { data: { sale, lots, viewer: { isFollowing } } };
  }

  async listSalesForPublicApi(
    filter: Parameters<ISaleRepository["list"]>[0],
  ): Promise<{ data: { sale: Sale; lots: Lot[] }[] }> {
    const rows = await this.list(filter);
    const data = await presentSalesWithLotsImages(this.mediaUrlResolver, rows);
    return { data };
  }

  async listSaleLotsPageForPublicApi(
    saleId: string,
    opts: { limit: number; offset: number; sort?: "lot" | "priceAsc" | "priceDesc" | "endingAsc" },
  ): Promise<{
    data: {
      items: Lot[];
      total: number;
      limit: number;
      offset: number;
      sort: typeof opts.sort;
    };
  } | null> {
    const page = await this.listLotsPage(saleId, opts);
    if (!page) return null;
    const items = await presentLotsImages(this.mediaUrlResolver, page.items);
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
    const all = await this.lotRepo.findBySaleId(saleId);
    const sorted = [...all];
    const parse = (p: string) => Number.parseFloat(p) || 0;
    switch (opts.sort ?? "lot") {
      case "priceAsc":
        sorted.sort((a, b) => parse(a.currentPrice) - parse(b.currentPrice));
        break;
      case "priceDesc":
        sorted.sort((a, b) => parse(b.currentPrice) - parse(a.currentPrice));
        break;
      case "endingAsc":
        sorted.sort((a, b) => a.endTime.getTime() - b.endTime.getTime());
        break;
      default:
        sorted.sort((a, b) => (a.lotNumber ?? 999_999) - (b.lotNumber ?? 999_999));
    }
    const items = sorted.slice(opts.offset, opts.offset + opts.limit);
    return { items, total: sorted.length };
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
    _userId: string,
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
    const { sale, lots } = bundle;
    if (sale.status !== "draft") {
      return err(new LotError("Only draft sales can be published"));
    }
    if (sale.startTime.getTime() <= Date.now()) {
      return err(new LotError("startTime must be in the future to publish"));
    }
    if (lots.length === 0) {
      return err(new LotError("Sale must have at least one lot to publish"));
    }
    const caps = getSaleModeCapabilities(sale.deliveryMode);
    for (const l of lots) {
      if (l.status !== "draft") {
        return err(new LotError("All lots in the sale must be draft to publish"));
      }
      if (!caps.inheritsLotTiming && l.startTime.getTime() <= Date.now()) {
        return err(new LotError("Each lot startTime must be in the future to publish"));
      }
      const violation = lotTimingViolationForSale(sale, l.startTime, l.endTime);
      if (violation) {
        return err(new LotError(`${violation} (lot "${l.title}")`, 400));
      }
    }

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
      const lotStart = caps.inheritsLotTiming ? sale.startTime : l.startTime;
      const lotEnd = caps.inheritsLotTiming ? sale.endTime : l.endTime;
      await this.jobScheduler?.scheduleLot(l.id, lotStart, lotEnd);
    }
    const updatedSale = await this.saleRepo.findById(saleId);
    if (!updatedSale) return err(new LotError("Sale not found", 404));
    const updatedLots = await this.lotRepo.findBySaleId(saleId);
    return ok({ sale: updatedSale, lots: updatedLots });
  }

  /** Revert a scheduled sale (and its scheduled lots) back to draft.
   *  Guard: only allowed when the sale is `scheduled` and all lots are still `scheduled`
   *  (i.e. no lot has gone active or ended yet — meaning no bids have been placed). */
  async unpublish(
    _userId: string,
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
      await this.lotRepo.updateStatus(l.id, "draft");
    }
    await this.saleRepo.updateStatus(saleId, "draft");
    const updated = await this.saleRepo.findById(saleId);
    if (!updated) return err(new LotError("Sale not found", 404));
    return ok(updated);
  }

  async cancel(
    _userId: string,
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
        await this.lotRepo.updateStatus(l.id, "cancelled");
      }
    }
    await this.saleRepo.updateStatus(saleId, "cancelled");
    const updated = await this.saleRepo.findById(saleId);
    if (!updated) return err(new LotError("Sale not found", 404));
    return ok(updated);
  }

  async addLot(
    userRole: string,
    saleId: string,
    row: CreateNestedLotForSaleInput,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can add lots to a sale", 403));
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
    const created = await this.lotRepo.create({
      ...lotFields,
      sellerLegalEntityId: sellerId,
      startTime: resolved.startTime,
      endTime: resolved.endTime,
      saleId,
    });
    return ok(created);
  }

  async attachExistingLot(
    userRole: string,
    saleId: string,
    lotId: string,
    userStaffRole?: string | null,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can attach lots", 403));
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
    const updated = await this.lotRepo.update(lotId, {
      saleId,
      lotNumber,
      startTime: resolved.startTime,
      endTime: resolved.endTime,
    });
    return ok(updated);
  }

  async detachLot(
    userRole: string,
    saleId: string,
    lotId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, LotError | AuthzError>> {
    if (
      !roleHasCapability(
        userRole as UserRole,
        "auction.manage",
        normalizeUserStaffRole(userStaffRole ?? undefined),
      )
    ) {
      return err(new AuthzError("Only staff with auction.manage can detach lots", 403));
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
    await this.lotRepo.clearSaleId(lotId);
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
      if (Object.keys(publishedPatch).length === 0) {
        return err(new LotError("Only draft sales can be edited"));
      }
      const updated = await this.saleRepo.update(saleId, publishedPatch);
      if (patch.coverImages !== undefined) {
        await this.imageCleanup?.enqueueRemovedMany(sale.coverImages, patch.coverImages);
      }
      return ok(updated);
    }
    const nextStart = patch.startTime ?? sale.startTime;
    const nextEnd = patch.endTime ?? sale.endTime;
    if (nextEnd <= nextStart) {
      return err(new LotError("endTime must be after startTime"));
    }
    const normalized: Partial<CreateSaleInput> = { ...(patch as Partial<CreateSaleInput>) };
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
    }
    if (caps.inheritsLotTiming) {
      const lots = await this.lotRepo.findBySaleId(saleId);
      for (const l of lots) {
        if (l.status === "draft") {
          await this.lotRepo.update(l.id, { startTime: nextStart, endTime: nextEnd });
        }
      }
    } else if (patch.startTime !== undefined || patch.endTime !== undefined) {
      const lots = await this.lotRepo.findBySaleId(saleId);
      const nextSale = {
        ...sale,
        deliveryMode: nextDelivery,
        startTime: nextStart,
        endTime: nextEnd,
      };
      for (const l of lots) {
        const violation = lotTimingViolationForSale(nextSale, l.startTime, l.endTime);
        if (violation) {
          return err(new LotError(`${violation} (lot "${l.title}")`, 400));
        }
      }
    }
    const updated = await this.saleRepo.update(saleId, normalized);
    if (patch.coverImages !== undefined) {
      await this.imageCleanup?.enqueueRemovedMany(sale.coverImages, patch.coverImages);
    }
    return ok(updated);
  }

  /** Read sale by id for joins (e.g. portfolio pricing). Resolves cover image URLs when configured. */
  async getById(id: string): Promise<Sale | null> {
    const row = await this.saleRepo.findById(id);
    if (!row) return null;
    return presentSaleImages(this.mediaUrlResolver, row);
  }

  /** Batch read by ids — single DB round trip for portfolio / lot-list pricing joins. */
  async findByIds(ids: string[]): Promise<Sale[]> {
    if (ids.length === 0) return [];
    const rows = await this.saleRepo.findByIds(ids);
    return Promise.all(rows.map((r) => presentSaleImages(this.mediaUrlResolver, r)));
  }
}
