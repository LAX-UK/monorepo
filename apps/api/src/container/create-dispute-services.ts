import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import {
  DrizzleDisputeCaseRepository,
  DrizzleDisputePaymentReader,
} from "@auction/persistence/repositories";
import { tryClaimProcessedStripeEvent } from "../lib/stripe-processed-event.js";
import { DisputeCaseRecorder } from "../services/disputes/dispute-case-recorder.js";
import { DisputeLineEffects } from "../services/disputes/dispute-line-effects.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { IPayoutAdjustmentService } from "../services/interfaces/payout-adjustment.js";
import { PAYMENT_WEBHOOK_EVENT_SOURCE } from "../services/stripe-webhook/payment-webhook-types.js";

export type CreateDisputeServicesInput = {
  db: Database;
  transactionRunner: ITransactionRunner;
  payoutAdjustments: IPayoutAdjustmentService;
  events: IDomainEventSink;
};

/** Dispute cases: the recorder behind Stripe's dispute webhooks. */
export function createDisputeCaseRecorder(input: CreateDisputeServicesInput): DisputeCaseRecorder {
  const cases = new DrizzleDisputeCaseRepository(input.db);
  return new DisputeCaseRecorder({
    transactionRunner: input.transactionRunner,
    claims: {
      claim: async (tx, eventId) =>
        (await tryClaimProcessedStripeEvent(tx, eventId, PAYMENT_WEBHOOK_EVENT_SOURCE)).claimed,
    },
    cases,
    payments: new DrizzleDisputePaymentReader(),
    effects: new DisputeLineEffects({
      cases,
      payoutAdjustments: input.payoutAdjustments,
      events: input.events,
    }),
    events: input.events,
  });
}
