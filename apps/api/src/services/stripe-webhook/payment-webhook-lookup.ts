import { payment } from "@auction/db/schema";
import type { IPaymentWebhookLookupReader } from "@auction/persistence";
import type { ITransactionRunner } from "@auction/persistence";
import type { IPaymentWriteRepository } from "@auction/persistence";
import type { IPayoutRepository } from "@auction/persistence";
import { eq } from "drizzle-orm";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IPaymentCaptureService } from "../interfaces/payment-capture.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";

export type StripePaymentWebhookDeps = {
  transactionRunner: ITransactionRunner;
  paymentWebhookLookup: IPaymentWebhookLookupReader;
  payments: IPaymentWriteRepository;
  payoutRepository: IPayoutRepository;
  payoutAdjustments: IPayoutAdjustmentService;
  paymentCapture: IPaymentCaptureService;
  domainEventSink: IDomainEventSink;
};

export type PaymentRowLookup = {
  id: string;
  sellerLegalEntityId: string;
  status: string;
  amount: string;
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
