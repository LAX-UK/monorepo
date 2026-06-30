import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IPaymentCaptureService } from "../interfaces/payment-capture.js";
import type { IPaymentWriteRepository } from "../interfaces/payment-write.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import type { IPayoutRepository } from "../interfaces/payout-repository.js";

export type StripePaymentWebhookDeps = {
  db: Database;
  payments: IPaymentWriteRepository;
  payoutRepository: IPayoutRepository;
  payoutAdjustments: IPayoutAdjustmentService;
  paymentCapture: IPaymentCaptureService;
  domainEventPublisher: DomainEventPublisher;
};

export type PaymentRowLookup = {
  id: string;
  sellerLegalEntityId: string;
  status: string;
  amount: string;
};

export async function findPaymentRow(
  deps: StripePaymentWebhookDeps,
  db: Database,
  opts: {
    chargeId?: string | null;
    paymentIntentId?: string | null;
    paymentId?: string | null;
  },
): Promise<PaymentRowLookup | null> {
  if (opts.paymentId) {
    const byId = await selectPaymentRow(deps, db, eq(payment.id, opts.paymentId));
    if (byId) return byId;
  }
  if (opts.chargeId) {
    const byCharge = await selectPaymentRow(deps, db, eq(payment.stripeChargeId, opts.chargeId));
    if (byCharge) return byCharge;
  }
  if (opts.paymentIntentId) {
    const byPi = await selectPaymentRow(
      deps,
      db,
      eq(payment.stripePaymentIntentId, opts.paymentIntentId),
    );
    if (byPi) return byPi;
  }
  return null;
}

async function selectPaymentRow(
  _deps: StripePaymentWebhookDeps,
  db: Database,
  where: ReturnType<typeof eq>,
) {
  const [row] = await db
    .select({
      id: payment.id,
      sellerLegalEntityId: payment.sellerLegalEntityId,
      status: payment.status,
      amount: payment.amount,
    })
    .from(payment)
    .where(where)
    .limit(1);
  if (!row || !row.sellerLegalEntityId) return null;
  return {
    id: row.id,
    sellerLegalEntityId: row.sellerLegalEntityId,
    status: row.status,
    amount: String(row.amount),
  };
}
