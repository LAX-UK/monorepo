import type {
  IPaymentRefundReconcileRepository,
  ITransactionRunner,
  PaymentRefundReconcilePayload,
} from "@auction/persistence";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IPaymentWriteRepository } from "../interfaces/payment-write.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";

export class PaymentRefundReconcileService {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly payments: IPaymentWriteRepository,
    private readonly payoutAdjustments: IPayoutAdjustmentService | null,
    private readonly publisher: DomainEventPublisher,
    private readonly repo: IPaymentRefundReconcileRepository,
  ) {}

  async enqueue(input: {
    paymentId: string;
    stripeRefundId: string | null;
    adminUserId: string | null;
    payload: PaymentRefundReconcilePayload;
  }): Promise<void> {
    await this.repo.enqueue(input);
  }

  async replayPending(limit = 25): Promise<{ attempted: number; reconciled: number }> {
    const rows = await this.repo.listPending(limit);
    let reconciled = 0;
    for (const row of rows) {
      const attempts = row.attempts + 1;
      try {
        await this.transactionRunner.runInTransaction(async (tx) => {
          const applied = await this.payments.applyRefundedInTransaction(
            tx,
            row.paymentId,
            row.stripeRefundId,
          );
          if (!applied) return;
          if (this.payoutAdjustments && row.payload.sellerLegalEntityId) {
            const negativeAmount = (-gbpAmountToPence(row.payload.amount) / 100).toFixed(2);
            await this.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
              legalEntityId: row.payload.sellerLegalEntityId,
              paymentId: row.paymentId,
              amount: negativeAmount,
              kind: "refund",
              sourceEventId: `admin_refund_reconcile:${row.paymentId}`,
              note: `Admin refund reconcile: ${row.paymentId}`,
              tx,
            });
          }
          await this.publisher.publish(tx, {
            aggregateType: "payment",
            aggregateId: row.paymentId,
            eventType: "payment.refunded",
            payload: {
              amount: row.payload.amount,
              currency: "GBP",
              sellerLegalEntityId: row.payload.sellerLegalEntityId,
              via: row.payload.via,
              stripeRefundId: row.stripeRefundId,
              reconciled: true,
            },
            actorUserId: row.adminUserId,
            actingLegalEntityId: row.payload.sellerLegalEntityId,
          });
        });
        const current = await this.payments.findById(row.paymentId);
        if (current?.status === "refunded") {
          await this.repo.markReconciled(row.paymentId);
          reconciled += 1;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await this.repo.markFailed(row.paymentId, msg, attempts);
      }
    }
    return { attempted: rows.length, reconciled };
  }
}
