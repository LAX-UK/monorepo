import type { Database } from "@auction/db";
import type Stripe from "stripe";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { tryClaimProcessedStripeEvent } from "../../../lib/stripe-processed-event.js";
import { StripeConnectNotConfiguredError } from "../../interfaces/stripe-connect.js";
import type { ConnectAccountService } from "./connect-account.service.js";

export class ConnectWebhookHandler {
  constructor(
    private readonly db: Database,
    private readonly stripeFactory: IStripeClientFactory,
    private readonly accountService: ConnectAccountService,
  ) {}

  private requireStripe(): Stripe {
    const stripe = this.stripeFactory.get();
    if (!stripe) throw new StripeConnectNotConfiguredError();
    return stripe;
  }

  private resolveAccountId(event: Stripe.Event): string | undefined {
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
    const accountId = this.resolveAccountId(event);
    if (!accountId) {
      return { processed: false };
    }

    const stripe = this.requireStripe();
    const account = await stripe.accounts.retrieve(accountId);

    return this.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedStripeEvent(tx, event.id, "stripe_connect");
      if (!claimed) {
        return { processed: true };
      }
      await this.accountService.applyAccountUpdate(account, tx);
      return { processed: true };
    });
  }
}
