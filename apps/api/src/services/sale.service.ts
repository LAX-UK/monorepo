import {
  type CreateSaleInput,
  type Lot,
  type Sale,
  type UserRole,
  roleHasCapability,
} from "@auction/types";
import type {
  CreateNestedLotForSaleInput,
  CreateSaleInput as ValidatorCreateSale,
} from "@auction/validators";
import { getSaleModeCapabilities } from "@auction/validators";
import type { updateSaleSchema } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { z } from "zod";
import { AuthzError, LotError } from "../lib/errors.js";
import type { ImageCleanupService } from "./image-cleanup.service.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";

type UpdateSaleBody = z.infer<typeof updateSaleSchema>;

const SALE_CANCELLABLE: ReadonlySet<Sale["status"]> = new Set(["draft", "scheduled", "active"]);

export class SaleService {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly lotRepo: ILotRepository,
    private readonly jobScheduler: ILotJobScheduler | null,
    private readonly imageCleanup?: ImageCleanupService,
  ) {}

  async create(adminId: string, input: ValidatorCreateSale): Promise<Sale> {
    if (input.endTime <= input.startTime) {
      throw new LotError("endTime must be after startTime");
    }
    const mode = input.deliveryMode ?? "onsite";
    const caps = getSaleModeCapabilities(mode);
    const sale = await this.saleRepo.create({ ...input, createdByLegalEntityId: adminId });
    if (input.lots?.length) {
      for (const row of input.lots) {
        const { sellerId, ...lotFields } = row;
        const inherited = caps.inheritsLotTiming
          ? { startTime: input.startTime, endTime: input.endTime }
          : {};
        await this.lotRepo.create({
          ...lotFields,
          sellerLegalEntityId: sellerId,
          ...inherited,
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
  ): Promise<Result<{ sale: Sale; lots: Lot[] }, LotError | AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "auction.manage")) {
      return err(new AuthzError("Only administrators can publish sales", 403));
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
    }

    if (caps.inheritsLotTiming) {
      for (const l of lots) {
        if (
          l.startTime.getTime() !== sale.startTime.getTime() ||
          l.endTime.getTime() !== sale.endTime.getTime()
        ) {
          await this.lotRepo.update(l.id, {
            startTime: sale.startTime,
            endTime: sale.endTime,
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

  async cancel(
    _userId: string,
    userRole: string,
    saleId: string,
  ): Promise<Result<Sale, LotError | AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "auction.manage")) {
      return err(new AuthzError("Only administrators can cancel sales", 403));
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
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "auction.manage")) {
      return err(new AuthzError("Only administrators can add lots to a sale", 403));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    if (sale.status !== "draft") {
      return err(new LotError("Lots can only be added while the sale is draft"));
    }
    const { sellerId, ...lotFields } = row;
    const caps = getSaleModeCapabilities(sale.deliveryMode);
    const startTime = caps.inheritsLotTiming ? sale.startTime : lotFields.startTime;
    const endTime = caps.inheritsLotTiming ? sale.endTime : lotFields.endTime;
    if (endTime <= startTime) {
      return err(new LotError("endTime must be after startTime"));
    }
    const created = await this.lotRepo.create({
      ...lotFields,
      sellerLegalEntityId: sellerId,
      startTime,
      endTime,
      saleId,
    });
    return ok(created);
  }

  async attachExistingLot(
    userRole: string,
    saleId: string,
    lotId: string,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "auction.manage")) {
      return err(new AuthzError("Only administrators can attach lots", 403));
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
    const caps = getSaleModeCapabilities(sale.deliveryMode);
    const timingPatch = caps.inheritsLotTiming
      ? { startTime: sale.startTime, endTime: sale.endTime }
      : {};
    const updated = await this.lotRepo.update(lotId, { saleId, lotNumber, ...timingPatch });
    return ok(updated);
  }

  async detachLot(
    userRole: string,
    saleId: string,
    lotId: string,
  ): Promise<Result<void, LotError | AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "auction.manage")) {
      return err(new AuthzError("Only administrators can detach lots", 403));
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
  ): Promise<Result<Sale, LotError | AuthzError>> {
    if (!roleHasCapability(userRole as UserRole, "auction.manage")) {
      return err(new AuthzError("Only administrators can edit sales", 403));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    if (sale.status !== "draft") {
      return err(new LotError("Only draft sales can be edited"));
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
    }
    const updated = await this.saleRepo.update(saleId, normalized);
    if (patch.coverImages !== undefined) {
      await this.imageCleanup?.enqueueRemovedMany(sale.coverImages, patch.coverImages);
    }
    return ok(updated);
  }
}
