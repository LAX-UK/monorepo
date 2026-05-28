import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { Env } from "../../../env.js";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { assertConnectUrlAllowed } from "../../../lib/stripe-connect-return-url.js";
import type { AccountLink } from "../../interfaces/stripe-connect.js";
import { StripeConnectNotConfiguredError } from "../../interfaces/stripe-connect.js";

export class ConnectLinkService {
  private readonly webOrigin: string;

  constructor(
    env: Env,
    private readonly db: Database,
    private readonly stripeFactory: IStripeClientFactory,
  ) {
    this.webOrigin = env.WEB_ORIGIN.replace(/\/$/, "");
  }

  private get stripe(): Stripe | null {
    return this.stripeFactory.get();
  }

  private requireStripe(): Stripe {
    if (!this.stripe) throw new StripeConnectNotConfiguredError();
    return this.stripe;
  }

  private async loadEntity(id: string) {
    const rows = await this.db.select().from(legalEntity).where(eq(legalEntity.id, id)).limit(1);
    const row = rows[0];
    if (!row) throw new Error("legal_entity_not_found");
    return row;
  }

  async createOnboardingLink(
    legalEntityId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<AccountLink> {
    assertConnectUrlAllowed(returnUrl, this.webOrigin);
    assertConnectUrlAllowed(refreshUrl, this.webOrigin);
    const stripe = this.requireStripe();
    const row = await this.loadEntity(legalEntityId);
    if (!row.stripeConnectAccountId) {
      throw new Error("stripe_account_missing");
    }
    const link = await stripe.accountLinks.create({
      account: row.stripeConnectAccountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return { url: link.url, expiresAt: new Date(link.expires_at * 1000) };
  }

  async createDashboardLink(legalEntityId: string): Promise<AccountLink> {
    const stripe = this.requireStripe();
    const row = await this.loadEntity(legalEntityId);
    if (!row.stripeConnectAccountId) throw new Error("stripe_account_missing");
    const link = await stripe.accounts.createLoginLink(row.stripeConnectAccountId);
    return { url: link.url, expiresAt: new Date(Date.now() + 5 * 60 * 1000) };
  }
}
