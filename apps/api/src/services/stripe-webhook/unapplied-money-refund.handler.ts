import type { ITransactionRunner, IUnappliedMoneyReader } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import type { IUnappliedMoneyRecorder } from "../payment/unapplied-money.recorder.js";
import {
  PAYMENT_WEBHOOK_EVENT_SOURCE,
  type PaymentWebhookResult,
} from "./payment-webhook-types.js";

/**
 * A refund of money we never applied (a second payment, money on a closed invoice) is finance
 * returning that money. It must not touch the invoice it names: that invoice is paid by other
 * money, and treating the refund as its refund would claw back the seller's payout.
 */
export class UnappliedMoneyRefundHandler {
  constructor(
    private readonly deps: {
      transactionRunner: ITransactionRunner;
      reader: Pick<
        IUnappliedMoneyReader,
        "listOpenByChargeId" | "isChargeOfPaidInvoice" | "wasEverUnapplied"
      >;
      recorder: Pick<IUnappliedMoneyRecorder, "resolveRefundedCharge">;
    },
  ) {}

  /** Handles the refund when the charge is unapplied money; null when it is an invoice's charge. */
  async handle(event: Stripe.Event, charge: Stripe.Charge): Promise<PaymentWebhookResult | null> {
    // The charge pays an invoice (a task raised before the payment was recorded, then closed by
    // the capture): this is that invoice's refund, with its handling and clawback.
    if (await this.deps.reader.isChargeOfPaidInvoice(charge.id)) return null;
    // Any other charge ever reported as unapplied money, open or closed, is never an invoice's
    // own money: its refund never touches an invoice or a seller's payout.
    if (!(await this.deps.reader.wasEverUnapplied(charge.id))) return null;
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(
        tx,
        event.id,
        PAYMENT_WEBHOOK_EVENT_SOURCE,
      );
      if (!claimed) return { processed: false, action: "skipped", reason: "duplicate_event" };
      const fullyRefunded = (charge.amount_refunded ?? 0) >= (charge.amount ?? 0);
      if (fullyRefunded) await this.deps.recorder.resolveRefundedCharge(tx, charge.id);
      return {
        processed: true,
        action: "unapplied_money_refunded",
        reason: fullyRefunded ? "refunded_in_full" : "refunded_in_part",
      };
    });
  }
}
