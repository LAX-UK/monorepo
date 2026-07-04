import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { tryClaimProcessedStripeEvent } from "../../../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../../../middleware/metrics.js";
import type { IConnectAccountWebhookPort } from "../../interfaces/stripe-connect.js";
import { StripeConnectNotConfiguredError } from "../../interfaces/stripe-connect.js";

const CONNECT_ACCOUNT_EVENT_TYPES = new Set([
  "account.updated",
  "capability.updated",
  "account.application.deauthorized",
]);

export class ConnectWebhookHandler {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly stripeFactory: IStripeClientFactory,
    private readonly accountPort: IConnectAccountWebhookPort,
  ) {}

  private requireStripe(): Stripe {
    const stripe = this.stripeFactory.get();
    if (!stripe) throw new StripeConnectNotConfiguredError();
    return stripe;
  }

  private resolveAccountId(event: Stripe.Event): string | undefined {
    if (event.type === "account.application.deauthorized") {
      return typeof event.account === "string" ? event.account : undefined;
    }
    if (event.type === "account.updated") {
      return (event.data.object as Stripe.Account).id;
    }
    if (event.type === "capability.updated") {
      const cap = event.data.object as Stripe.Capability;
      return typeof cap.account === "string" ? cap.account : cap.account?.id;
    }
    return undefined;
  }

  async handleConnectedAccountEvent(event: Stripe.Event): Promise<{ processed: boolean }> {
    if (!CONNECT_ACCOUNT_EVENT_TYPES.has(event.type)) {
      recordMoneyPathEvent("stripe_connect_webhook_unhandled_event");
      return { processed: false };
    }

    if (event.type === "account.application.deauthorized") {
      const accountId = this.resolveAccountId(event);
      if (!accountId) {
        recordMoneyPathEvent("stripe_connect_webhook_unhandled_event");
        return { processed: false };
      }

      return this.transactionRunner.runInTransaction(async (tx) => {
        const { claimed } = await tryClaimProcessedStripeEvent(tx, event.id, "stripe_connect");
        if (!claimed) {
          return { processed: true };
        }
        await this.accountPort.applyAccountDeauthorized(accountId, tx);
        return { processed: true };
      });
    }

    const accountId = this.resolveAccountId(event);
    if (!accountId) {
      recordMoneyPathEvent("stripe_connect_webhook_unhandled_event");
      return { processed: false };
    }

    const stripe = this.requireStripe();
    const account = await stripe.accounts.retrieve(accountId);

    return this.transactionRunner.runInTransaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(tx, event.id, "stripe_connect");
      if (!claimed) {
        return { processed: true };
      }
      await this.accountPort.applyAccountUpdate(account, tx);
      return { processed: true };
    });
  }
}
