import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { IUnappliedMoneyRecorder } from "../unapplied-money.recorder.js";
import type { ILatePaymentRecorder } from "./stale-payment-expiry.js";

type Paid = Parameters<ILatePaymentRecorder["recordPaid"]>[0];

/** The capture the webhook would have made, for a process that can run it (the API). */
export interface ILatePaymentCapture {
  capture(input: {
    paymentId: string;
    via: "stripe_payment_intent";
    stripePaymentIntentId: string;
    stripeChargeId: string | null;
  }): Promise<unknown>;
}

function unapplied(paid: Paid, reason: "amount_mismatch" | "paid_not_recorded") {
  return {
    reason,
    paymentId: paid.paymentId,
    paymentGroupId: null,
    stripePaymentIntentId: paid.state.paymentIntentId,
    stripeChargeId: paid.state.chargeId,
    stripeCustomerId: null,
    amountCents: paid.state.amountReceivedPence,
    currency: "GBP",
  };
}

/**
 * The API records late money as paid through the webhook's capture path (receipt, fulfilment,
 * books). Money of a different amount is never captured; it goes to finance.
 */
export class CapturingLatePaymentRecorder implements ILatePaymentRecorder {
  constructor(
    private readonly capture: ILatePaymentCapture,
    private readonly unappliedMoney: Pick<IUnappliedMoneyRecorder, "record">,
    private readonly transactionRunner: ITransactionRunner,
  ) {}

  async recordPaid(paid: Paid): Promise<void> {
    if (paid.state.amountReceivedPence !== paid.amountPence) {
      await this.transactionRunner.runInTransaction((tx) =>
        this.unappliedMoney.record(tx, unapplied(paid, "amount_mismatch"), paid.buyerLegalEntityId),
      );
      return;
    }
    await this.capture.capture({
      paymentId: paid.paymentId,
      via: "stripe_payment_intent",
      stripePaymentIntentId: paid.state.paymentIntentId,
      stripeChargeId: paid.state.chargeId,
    });
  }
}

/**
 * The worker cannot send the receipt or record the payment in the books, so it leaves the invoice
 * open and gives finance a task to record it; nothing is cancelled.
 */
export class FinanceTaskLatePaymentRecorder implements ILatePaymentRecorder {
  constructor(
    private readonly unappliedMoney: Pick<IUnappliedMoneyRecorder, "record">,
    private readonly transactionRunner: ITransactionRunner,
  ) {}

  async recordPaid(paid: Paid): Promise<void> {
    const reason =
      paid.state.amountReceivedPence === paid.amountPence ? "paid_not_recorded" : "amount_mismatch";
    await this.transactionRunner.runInTransaction((tx) =>
      this.unappliedMoney.record(tx, unapplied(paid, reason), paid.buyerLegalEntityId),
    );
  }
}
