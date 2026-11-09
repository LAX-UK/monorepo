import type { UpdateLotFulfilmentInput } from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import type {
  ILotFulfilmentAdminService,
  LotFulfilmentListRow,
  LotFulfilmentRow,
  LotFulfilmentServiceError,
} from "../interfaces/lot-fulfilment-service.js";
import type { LotFulfilmentStep } from "./lot-fulfilment-buyer-notifier.js";
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
    return this.transition(input.lotId, "awaiting_release", {
      status: "released",
      releaseApprovedByUserId: input.actorUserId,
      releaseApprovedAt: new Date(),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
    });
  }

  async markShipped(input: {
    lotId: string;
    actorUserId: string;
    carrier: string;
    trackingNumber: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    void input.actorUserId;
    return this.transition(
      input.lotId,
      "released",
      {
        status: "in_transit",
        fulfilmentMethod: "shipping",
        shippingCarrier: input.carrier,
        trackingNumber: input.trackingNumber,
        updatedAt: new Date(),
      },
      {
        kind: "shipped",
        lotId: input.lotId,
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
      },
    );
  }

  async markReadyForCollection(input: {
    lotId: string;
    actorUserId: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    void input.actorUserId;
    return this.transition(
      input.lotId,
      "released",
      {
        status: "ready_for_collection",
        fulfilmentMethod: "collection",
        updatedAt: new Date(),
      },
      { kind: "ready_for_collection", lotId: input.lotId },
    );
  }

  async markDelivered(input: {
    lotId: string;
    actorUserId: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    void input.actorUserId;
    return this.transition(
      input.lotId,
      "in_transit",
      {
        status: "delivered",
        updatedAt: new Date(),
      },
      { kind: "delivered", lotId: input.lotId, method: "delivery" },
    );
  }

  async markCollected(input: {
    lotId: string;
    actorUserId: string;
    collectedBy: string;
  }): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    return this.transition(
      input.lotId,
      "ready_for_collection",
      {
        status: "delivered",
        collectedBy: input.collectedBy,
        collectedByUserId: input.actorUserId,
        collectedAt: new Date(),
        updatedAt: new Date(),
      },
      { kind: "delivered", lotId: input.lotId, method: "collection" },
    );
  }

  /**
   * Moves a lot's fulfilment to the patch, only from the statuses it requires, as one conditional
   * update: two actions on the same lot (this one and another, or the collection desk) cannot both
   * succeed, because the second finds the status already changed. A lot that did not move is
   * reported as missing or in the wrong status.
   */
  private async transition(
    lotId: string,
    requiredStatus: LotFulfilmentRow["status"] | readonly LotFulfilmentRow["status"][],
    patch: UpdateLotFulfilmentInput,
    notice?: LotFulfilmentStep,
  ): Promise<Result<LotFulfilmentRow, LotFulfilmentServiceError>> {
    const allowed = typeof requiredStatus === "string" ? [requiredStatus] : requiredStatus;
    const moved = await this.ctx.fulfilmentRepo.updateIfStatus(lotId, allowed, patch);
    if (!moved) {
      const row = await this.ctx.fulfilmentRepo.findByLotId(lotId);
      if (!row) {
        return err({
          message: "No fulfilment record for this lot",
          status: 404,
          code: "no_fulfilment",
        });
      }
      return err({
        message: `Lot must be in status "${allowed.join('" or "')}" (currently "${row.status}")`,
        status: 400,
        code: "invalid_status",
      });
    }
    const next = await this.ctx.fulfilmentRepo.findByLotId(lotId);
    if (!next) return err({ message: "Fulfilment row missing after update", status: 500 });
    // Only a step that moved the lot is announced: a repeat finds the status changed above.
    if (notice) await this.ctx.buyerNotifier?.notify(notice);
    return ok(next);
  }
}
