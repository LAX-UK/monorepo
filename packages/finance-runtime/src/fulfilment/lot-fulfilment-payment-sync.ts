import type {
  ILotFulfilmentPaymentHook,
  ILotFulfilmentRepository,
  LotFulfilmentAddressSnapshot,
} from "@auction/persistence/interfaces";

type FulfilmentStore = Pick<ILotFulfilmentRepository, "findByLotId" | "insert" | "updateByLotId">;

/**
 * Keeps a lot's fulfilment record in step with its invoice: "awaiting payment" once the invoice is
 * raised, "awaiting release" once it is paid. Shared by the API and the worker so an invoice
 * raised at lot end has the same fulfilment record as one raised at checkout.
 */
export class LotFulfilmentPaymentSync implements ILotFulfilmentPaymentHook {
  constructor(
    private readonly fulfilment: FulfilmentStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Called when a pending payment exists for the lot (create or reuse). */
  async ensureAwaitingPayment(
    lotId: string,
    paymentId: string,
    addressSnapshot?: LotFulfilmentAddressSnapshot | null,
  ): Promise<void> {
    const snapshotJson = addressSnapshot ?? null;
    const existing = await this.fulfilment.findByLotId(lotId);
    if (!existing) {
      await this.fulfilment.insert({
        lotId,
        paymentId,
        status: "awaiting_payment",
        ...(snapshotJson ? { addressSnapshot: snapshotJson } : {}),
      });
      return;
    }
    if (existing.status === "awaiting_payment") {
      await this.fulfilment.updateByLotId(lotId, {
        paymentId,
        updatedAt: new Date(),
        ...(snapshotJson ? { addressSnapshot: snapshotJson } : {}),
      });
    }
  }

  /** Called after payment is captured (Stripe / Xero / admin). */
  async onPaymentCaptured(lotId: string, paymentId: string): Promise<void> {
    const row = await this.fulfilment.findByLotId(lotId);
    if (!row) {
      await this.fulfilment.insert({
        lotId,
        paymentId,
        status: "awaiting_release",
        paymentClearedAt: this.now(),
      });
      return;
    }
    if (row.status === "awaiting_payment" || row.status === "awaiting_release") {
      await this.fulfilment.updateByLotId(lotId, {
        paymentId,
        status: "awaiting_release",
        // The first time it cleared is the one "please collect by" counts from.
        ...(row.paymentClearedAt ? {} : { paymentClearedAt: this.now() }),
        updatedAt: this.now(),
      });
    }
  }
}
