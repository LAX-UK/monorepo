import { payment } from "@auction/db/schema";
import type {
  IPaymentRefundLedger,
  IPaymentWebhookLookupReader,
} from "@auction/persistence/interfaces";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { IPaymentWriteRepository } from "@auction/persistence/interfaces";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import { eq } from "drizzle-orm";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IErrorReporter } from "../interfaces/error-handling.js";
import type { IPaymentCaptureService } from "../interfaces/payment-capture.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import type { IUnappliedMoneyRecorder } from "../payment/unapplied-money.recorder.js";

import type { IPaymentEligibilityGate } from "@auction/finance-runtime";

import type { IChargeRefundsReader } from "../stripe/stripe-charge-refunds.js";

export type StripePaymentWebhookDeps = {
  transactionRunner: ITransactionRunner;
  paymentWebhookLookup: IPaymentWebhookLookupReader;
  payments: IPaymentWriteRepository;
  payoutRepository: IPayoutRepository;
  /** What the buyer was refunded: where a refund's delta is measured from, and recorded to. */
  paymentRefunds: IPaymentRefundLedger;
  payoutAdjustments: IPayoutAdjustmentService;
  paymentCapture: IPaymentCaptureService;
  domainEventSink: IDomainEventSink;
  /** Where money that cannot be applied to its invoice goes: a finance task, never a refund. */
  unappliedMoney: IUnappliedMoneyRecorder;
  /**
   * Whether the buyer account may pay now. Money for an account that may not (held, or closed)
   * goes to manual review instead of being captured. Null only where it is not wired (tests).
   */
  paymentEligibility: IPaymentEligibilityGate | null;
  /** Where a capture's failed follow-up steps are reported; they never fail the webhook. */
  errorReporter?: IErrorReporter;
  /**
   * Stripe's refunds for a charge: what a refund event is measured against (only succeeded
   * refunds count). Absent where it is not wired; a refund event then fails and is retried.
   */
  chargeRefunds?: IChargeRefundsReader;
};

export type PaymentRowLookup = {
  id: string;
  sellerLegalEntityId: string;
  status: string;
  amount: string;
  stripeChargeId?: string | null;
  stripePaymentIntentId?: string | null;
  everCaptured?: boolean;
};

export async function findPaymentRow(
  deps: StripePaymentWebhookDeps,
  opts: {
    chargeId?: string | null;
    paymentIntentId?: string | null;
    paymentId?: string | null;
  },
): Promise<PaymentRowLookup | null> {
  if (opts.paymentId) {
    const byId = await deps.paymentWebhookLookup.findPaymentRow(eq(payment.id, opts.paymentId));
    if (byId) return byId;
  }
  if (opts.chargeId) {
    const byCharge = await deps.paymentWebhookLookup.findPaymentRow(
      eq(payment.stripeChargeId, opts.chargeId),
    );
    if (byCharge) return byCharge;
  }
  if (opts.paymentIntentId) {
    const byPi = await deps.paymentWebhookLookup.findPaymentRow(
      eq(payment.stripePaymentIntentId, opts.paymentIntentId),
    );
    if (byPi) return byPi;
  }
  return null;
}
