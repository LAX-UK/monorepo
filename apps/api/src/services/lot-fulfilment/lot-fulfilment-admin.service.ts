import { type Result, err, ok } from "neverthrow";
import type {
  ILotFulfilmentAdminService,
  LotFulfilmentListRow,
  LotFulfilmentRow,
  LotFulfilmentServiceError,
} from "../interfaces/lot-fulfilment-service.js";
import type { LotFulfilmentContext } from "./lot-fulfilment-context.js";

export class LotFulfilmentAdminService implements ILotFulfilmentAdminService {
  constructor(private readonly ctx: LotFulfilmentContext) {}

  async listForAdmin(options?: {
    status?: LotFulfilmentRow["status"];
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: LotFulfilmentListRow[];
    total: number;
  }> {
    return this.ctx.fulfilmentRepo.listForAdmin(options);
  }

  async getByLotIdForAdmin(lotId: string): Promise<LotFulfilmentRow | null> {
    return this.ctx.fulfilmentRepo.findByLotId(lotId);
  }

  async approveRelease(input: {
    lotId: string;
    actorUserId: string;
    notes?: string | undefined;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    return this.transition(input.lotId, "awaiting_release", async () => {
      await this.ctx.fulfilmentRepo.updateByLotId(input.lotId, {
        status: "released",
        releaseApprovedByUserId: input.actorUserId,
        releaseApprovedAt: new Date(),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updatedAt: new Date(),
      });
    });
  }

  async markShipped(input: {
    lotId: string;
    actorUserId: string;
    carrier: string;
    trackingNumber: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    void input.actorUserId;
    return this.transition(input.lotId, "released", async () => {
      await this.ctx.fulfilmentRepo.updateByLotId(input.lotId, {
        status: "in_transit",
        fulfilmentMethod: "shipping",
        shippingCarrier: input.carrier,
        trackingNumber: input.trackingNumber,
        updatedAt: new Date(),
      });
    });
  }

  async markReadyForCollection(input: {
    lotId: string;
    actorUserId: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    void input.actorUserId;
    return this.transition(input.lotId, "released", async () => {
      await this.ctx.fulfilmentRepo.updateByLotId(input.lotId, {
        status: "ready_for_collection",
        fulfilmentMethod: "collection",
        updatedAt: new Date(),
      });
    });
  }

  async markDelivered(input: {
    lotId: string;
    actorUserId: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    void input.actorUserId;
    return this.transition(input.lotId, "in_transit", async () => {
      await this.ctx.fulfilmentRepo.updateByLotId(input.lotId, {
        status: "delivered",
        updatedAt: new Date(),
      });
    });
  }

  async markCollected(input: {
    lotId: string;
    actorUserId: string;
    collectedBy: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    void input.actorUserId;
    return this.transition(input.lotId, "ready_for_collection", async () => {
      await this.ctx.fulfilmentRepo.updateByLotId(input.lotId, {
        status: "delivered",
        collectedBy: input.collectedBy,
        collectedAt: new Date(),
        updatedAt: new Date(),
      });
    });
  }

  private async transition(
    lotId: string,
    requiredStatus: LotFulfilmentRow["status"],
    patch: () => Promise<void>,
  ): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    const row = await this.ctx.fulfilmentRepo.findByLotId(lotId);
    if (!row) {
      return err({
        message: "No fulfilment record for this lot",
        status: 404,
        code: "no_fulfilment",
      });
    }
    if (row.status !== requiredStatus) {
      return err({
        message: `Lot must be in status "${requiredStatus}" (currently "${row.status}")`,
        status: 400,
        code: "invalid_status",
      });
    }
    await patch();
    const next = await this.ctx.fulfilmentRepo.findByLotId(lotId);
    return next ? ok(next) : err({ message: "Fulfilment row missing after update", status: 500 });
  }
}
