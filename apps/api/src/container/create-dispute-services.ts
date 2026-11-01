import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import {
  DrizzleAdminDisputeDeskReader,
  DrizzleDisputeCaseRepository,
  DrizzleDisputePaymentReader,
} from "@auction/persistence/repositories";
import { tryClaimProcessedStripeEvent } from "../lib/stripe-processed-event.js";
import {
  AdminDisputeDeskService,
  type IDisputeAllocator,
} from "../services/admin/admin-dispute-desk.service.js";
import { DisputeAllocationService } from "../services/disputes/dispute-allocation.service.js";
import { DisputeCaseRecorder } from "../services/disputes/dispute-case-recorder.js";
import { DisputeLineEffects } from "../services/disputes/dispute-line-effects.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { IAdminDisputeDeskService } from "../services/interfaces/admin-routes/admin-compliance-routes.js";
import type { IPayoutAdjustmentService } from "../services/interfaces/payout-adjustment.js";
import { PAYMENT_WEBHOOK_EVENT_SOURCE } from "../services/stripe-webhook/payment-webhook-types.js";

export type CreateDisputeServicesInput = {
  db: Database;
  transactionRunner: ITransactionRunner;
  payoutAdjustments: IPayoutAdjustmentService;
  events: IDomainEventSink;
};

function createDisputeLineEffects(input: CreateDisputeServicesInput) {
  return new DisputeLineEffects({
    cases: new DrizzleDisputeCaseRepository(input.db),
    payoutAdjustments: input.payoutAdjustments,
    events: input.events,
  });
}

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
    effects: createDisputeLineEffects(input),
    events: input.events,
  });
}

/** The finance team's allocation of a dispute across the invoices it falls on. */
export function createDisputeAllocationService(
  input: CreateDisputeServicesInput,
): DisputeAllocationService {
  return new DisputeAllocationService({
    transactionRunner: input.transactionRunner,
    cases: new DrizzleDisputeCaseRepository(input.db),
    payments: new DrizzleDisputePaymentReader(),
    effects: createDisputeLineEffects(input),
    events: input.events,
  });
}

/** The Disputes screen of Bid admin: its list and case reads, and the allocation. */
export function createAdminDisputeDesk(input: {
  db: Database;
  allocator: IDisputeAllocator;
}): IAdminDisputeDeskService {
  return new AdminDisputeDeskService(new DrizzleAdminDisputeDeskReader(input.db), input.allocator);
}
