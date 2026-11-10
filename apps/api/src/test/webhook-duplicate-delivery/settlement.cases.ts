import { vi } from "vitest";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import {
  type IProviderEventClaim,
  type PaymentGroupSettlementDeps,
  PaymentGroupSettlementService,
} from "../../services/payment-group/payment-group-settlement.service.js";
import { DealPaymentSettlementService } from "../../services/private-sale-deal/deal-payment-settlement.service.js";
import { PAYMENT_WEBHOOK_EVENT_SOURCE } from "../../services/stripe-webhook/payment-webhook-types.js";
import { type DeliveryCase, duplicateEventResult, eventSink, stub } from "./support.js";

/** The claim the container wires into the settlement services: the real, transactional one. */
const claims: IProviderEventClaim = {
  claim: async (tx, eventId) =>
    (await tryClaimProcessedStripeEvent(tx, eventId, PAYMENT_WEBHOOK_EVENT_SOURCE)).claimed,
};

export const settlementCases: DeliveryCase[] = [
  {
    name: "combined payment moves to processing",
    claimsTable: "processed_stripe_events",
    claimedEventId: (eventId) => eventId,
    build(eventId, runner) {
      const authorise = vi.fn(async () => undefined);
      const service = new PaymentGroupSettlementService(
        stub<PaymentGroupSettlementDeps>({
          transactionRunner: runner,
          claims,
          events: eventSink(),
          payments: stub({ applyAuthorizedInTransaction: authorise }),
          groups: stub({
            lockInTransaction: async () => ({
              group: { status: "open", totalAmount: "10.00", currency: "GBP", id: "group_1" },
              members: [{ paymentId: "pay_1" }],
              deliveries: [],
            }),
            transitionInTransaction: async () => true,
          }),
        }),
      );
      return {
        deliver: () => service.markProcessing({ eventId, groupId: "group_1" }),
        effect: authorise,
        isDuplicate: duplicateEventResult,
      };
    },
  },
  {
    name: "private sale payment moves to processing",
    claimsTable: "processed_stripe_events",
    claimedEventId: (eventId) => eventId,
    build(eventId, runner) {
      const markProcessing = vi.fn(async () => true);
      const service = new DealPaymentSettlementService({
        transactionRunner: runner,
        claims,
        scopeForTx: () => ({ payments: { markProcessing } }) as never,
        transitions: stub(),
        unappliedMoney: stub(),
        payouts: stub(),
      });
      return {
        deliver: () => service.markProcessing({ eventId, paymentId: "deal_payment_1" }),
        effect: markProcessing,
        isDuplicate: duplicateEventResult,
      };
    },
  },
];
