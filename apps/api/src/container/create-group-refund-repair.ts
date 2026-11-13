import type { Database } from "@auction/db";
import {
  DrizzlePaymentGroupRepository,
  DrizzlePaymentRefundRepository,
  DrizzlePaymentRepository,
  DrizzlePayoutRepository,
  DrizzleTransactionRunner,
} from "@auction/persistence/repositories";
import { StripeClientFactory } from "../lib/stripe-client.js";
import { DomainEventSink } from "../services/domain-event-sink.js";
import { DomainEventPublisher } from "../services/domain-event.publisher.js";
import { GroupRefundRepairService } from "../services/payment-group/group-refund-repair.service.js";
import { PayoutAdjustmentService } from "../services/payout/payout-adjustment.service.js";
import { payoutRepoForTx } from "../services/payout/payout-helpers.js";
import { StripeChargeRefunds } from "../services/stripe/stripe-charge-refunds.js";

/** The repair command's wiring: the database it repairs and the Stripe account it reads. */
export function createGroupRefundRepair(
  db: Database,
  stripeSecretKey: string,
): GroupRefundRepairService {
  const transactionRunner = new DrizzleTransactionRunner(db);
  const payouts = new DrizzlePayoutRepository(db);
  return new GroupRefundRepairService({
    transactionRunner,
    groups: new DrizzlePaymentGroupRepository(db),
    refunds: new StripeChargeRefunds(
      new StripeClientFactory({ STRIPE_SECRET_KEY: stripeSecretKey }),
    ),
    payments: new DrizzlePaymentRepository(db),
    paymentRefunds: new DrizzlePaymentRefundRepository(db),
    sellerRefundedCents: (tx, paymentId) =>
      payoutRepoForTx(payouts, tx).sumRefundLineCentsForPayment(paymentId),
    payoutAdjustments: new PayoutAdjustmentService(transactionRunner, payouts),
    events: new DomainEventSink(new DomainEventPublisher(), db),
  });
}
