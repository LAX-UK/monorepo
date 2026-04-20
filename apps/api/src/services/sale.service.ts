import type { CreateSaleInput, Lot, Sale } from "@auction/types";
import type {
  CreateNestedLotForSaleInput,
  CreateSaleInput as ValidatorCreateSale,
} from "@auction/validators";
import type { updateSaleSchema } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { z } from "zod";
import { AuthzError, LotError } from "../lib/errors.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";

type UpdateSaleBody = z.infer<typeof updateSaleSchema>;

const SALE_CANCELLABLE: ReadonlySet<Sale["status"]> = new Set(["draft", "scheduled", "active"]);

export class SaleService {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly lotRepo: ILotRepository,
    private readonly jobScheduler: ILotJobScheduler | null,
  ) {}

  async create(adminId: string, input: ValidatorCreateSale): Promise<Sale> {
    if (input.endTime <= input.startTime) {
      throw new LotError("endTime must be after startTime");
    }
    const sale = await this.saleRepo.create({ ...input, createdBy: adminId });
    if (input.lots?.length) {
      for (const row of input.lots) {
        const { sellerId, ...lotFields } = row;
        await this.lotRepo.create(sellerId, {
          ...lotFields,
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
    if (userRole !== "admin") {
      return err(new AuthzError("Only admins can publish sales", 403));
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
    for (const l of lots) {
      if (l.status !== "draft") {
        return err(new LotError("All lots in the sale must be draft to publish"));
      }
      if (l.startTime.getTime() <= Date.now()) {
        return err(new LotError("Each lot startTime must be in the future to publish"));
      }
    }

    await this.saleRepo.updateStatus(saleId, "scheduled");
    for (const l of lots) {
      await this.lotRepo.updateStatus(l.id, "scheduled");
      await this.jobScheduler?.scheduleLot(l.id, l.startTime, l.endTime);
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
    if (userRole !== "admin") {
      return err(new AuthzError("Only admins can cancel sales", 403));
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
    if (userRole !== "admin") {
      return err(new AuthzError("Only admins can add lots to a sale", 403));
    }
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return err(new LotError("Sale not found", 404));
    if (sale.status !== "draft") {
      return err(new LotError("Lots can only be added while the sale is draft"));
    }
    const { sellerId, ...lotFields } = row;
    if (lotFields.endTime <= lotFields.startTime) {
      return err(new LotError("endTime must be after startTime"));
    }
    const created = await this.lotRepo.create(sellerId, { ...lotFields, saleId });
    return ok(created);
  }

  async attachExistingLot(
    userRole: string,
    saleId: string,
    lotId: string,
  ): Promise<Result<Lot, LotError | AuthzError>> {
    if (userRole !== "admin") {
      return err(new AuthzError("Only admins can attach lots", 403));
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
    const updated = await this.lotRepo.update(lotId, { saleId, lotNumber });
    return ok(updated);
  }

  async detachLot(
    userRole: string,
    saleId: string,
    lotId: string,
  ): Promise<Result<void, LotError | AuthzError>> {
    if (userRole !== "admin") {
      return err(new AuthzError("Only admins can detach lots", 403));
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
    if (userRole !== "admin") {
      return err(new AuthzError("Only admins can edit sales", 403));
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
    if (nextDelivery === "onsite") {
      normalized.streamUrl = null;
    }
    const updated = await this.saleRepo.update(saleId, normalized);
    return ok(updated);
  }
}
