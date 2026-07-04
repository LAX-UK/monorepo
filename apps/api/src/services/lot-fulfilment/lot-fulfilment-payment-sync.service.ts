import type { LotFulfilmentAddressSnapshot } from "@auction/persistence";
import type { ILotFulfilmentPaymentSyncService } from "../interfaces/lot-fulfilment-service.js";
import type { LotFulfilmentContext } from "./lot-fulfilment-context.js";

export class LotFulfilmentPaymentSyncService implements ILotFulfilmentPaymentSyncService {
  constructor(private readonly ctx: LotFulfilmentContext) {}

  /** Called when a pending payment exists for the lot (create or reuse). */
  async ensureAwaitingPayment(
    lotId: string,
    paymentId: string,
    addressSnapshot?: LotFulfilmentAddressSnapshot | null,
  ): Promise<void> {
    const snapshotJson = addressSnapshot ?? null;
    const existing = await this.ctx.fulfilmentRepo.findByLotId(lotId);
    if (!existing) {
      await this.ctx.fulfilmentRepo.insert({
        lotId,
        paymentId,
        status: "awaiting_payment",
        ...(snapshotJson ? { addressSnapshot: snapshotJson } : {}),
      });
      return;
    }
    if (existing.status === "awaiting_payment") {
      await this.ctx.fulfilmentRepo.updateByLotId(lotId, {
        paymentId,
        updatedAt: new Date(),
        ...(snapshotJson ? { addressSnapshot: snapshotJson } : {}),
      });
    }
  }

  /** Called after payment is captured (Stripe / Xero / admin). */
  async onPaymentCaptured(lotId: string, paymentId: string): Promise<void> {
    const row = await this.ctx.fulfilmentRepo.findByLotId(lotId);
    if (!row) {
      await this.ctx.fulfilmentRepo.insert({
        lotId,
        paymentId,
        status: "awaiting_release",
      });
      return;
    }
    if (row.status === "awaiting_payment" || row.status === "awaiting_release") {
      await this.ctx.fulfilmentRepo.updateByLotId(lotId, {
        paymentId,
        status: "awaiting_release",
        updatedAt: new Date(),
      });
    }
  }
}
