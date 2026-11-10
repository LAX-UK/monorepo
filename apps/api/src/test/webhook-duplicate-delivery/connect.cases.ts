import { vi } from "vitest";
import { ConnectBankChangeHandler } from "../../services/stripe/connect/connect-bank-change.handler.js";
import { ConnectTransferWebhookService } from "../../services/stripe/connect/connect-transfer-webhook.service.js";
import { ConnectWebhookHandler } from "../../services/stripe/connect/connect-webhook.handler.js";
import { type DeliveryCase, eventSink, stripeEvent, stub } from "./support.js";

const ACCOUNT_ID = "acct_duplicate_delivery";

/** A connected-account event handler; its result cannot say "duplicate", so the effect count does. */
function connectAccountCase(
  name: string,
  type: string,
  effectMethod: "applyAccountDeauthorized" | "applyAccountUpdate",
): DeliveryCase {
  return {
    name,
    claimsTable: "processed_stripe_events",
    claimedEventId: (eventId) => eventId,
    build(eventId, runner) {
      const effect = vi.fn(async () => undefined);
      const handler = new ConnectWebhookHandler(
        runner,
        { get: () => ({ accounts: { retrieve: async () => ({ id: ACCOUNT_ID }) } }) } as never,
        stub({ [effectMethod]: effect }),
      );
      const event = stripeEvent(eventId, type, { id: ACCOUNT_ID }, ACCOUNT_ID);
      return { deliver: () => handler.handleConnectedAccountEvent(event), effect };
    },
  };
}

export const connectCases: DeliveryCase[] = [
  connectAccountCase(
    "connected account deauthorised",
    "account.application.deauthorized",
    "applyAccountDeauthorized",
  ),
  connectAccountCase("connected account updated", "account.updated", "applyAccountUpdate"),
  {
    name: "connected account payout bank changed",
    claimsTable: "processed_stripe_events",
    claimedEventId: (eventId) => eventId,
    build(eventId, runner) {
      const publish = vi.fn(async () => undefined);
      const handler = new ConnectBankChangeHandler({
        transactionRunner: runner,
        accounts: {
          findLegalEntityRowByStripeAccountId: async () =>
            ({ id: "le_duplicate_delivery", displayName: "Gallery" }) as never,
        },
        events: eventSink(publish),
        notifier: stub({ bankChanged: async () => undefined }),
      });
      const event = stripeEvent(
        eventId,
        "account.external_account.updated",
        { object: "bank_account", default_for_currency: true, last4: "1234", bank_name: null },
        ACCOUNT_ID,
      );
      return { deliver: () => handler.handle(event), effect: publish };
    },
  },
  {
    name: "transfer to a connected account",
    claimsTable: "processed_stripe_events",
    claimedEventId: (eventId) => eventId,
    build(eventId, runner) {
      const reconcile = vi.fn(async () => ({}));
      const service = new ConnectTransferWebhookService(
        runner,
        stub({ reconcileStripeTransfer: reconcile }),
      );
      const event = stripeEvent(eventId, "transfer.created", {
        id: "tr_duplicate_delivery",
        amount: 100,
        created: 1_700_000_000,
        metadata: { payoutId: "payout_1" },
      });
      return { deliver: () => service.handleTransferEvent(event), effect: reconcile };
    },
  },
];
