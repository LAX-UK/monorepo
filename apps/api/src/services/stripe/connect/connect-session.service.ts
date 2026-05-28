import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { Env } from "../../../env.js";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { StripeConnectNotConfiguredError } from "../../interfaces/stripe-connect.js";

export type ConnectSessionSurface = "onboarding" | "management";

export type AccountSessionResult = {
  clientSecret: string;
};

export type ConnectClientConfig = {
  publishableKey: string | null;
  connectEnforced: boolean;
};

export class ConnectSessionService {
  constructor(
    private readonly env: Env,
    private readonly db: Database,
    private readonly stripeFactory: IStripeClientFactory,
  ) {}

  private get stripe(): Stripe | null {
    return this.stripeFactory.get();
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  getClientConfig(): ConnectClientConfig {
    return {
      publishableKey: this.env.STRIPE_PUBLISHABLE_KEY ?? null,
      connectEnforced: this.isConfigured(),
    };
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

  private buildComponents(
    role: string,
    surface: ConnectSessionSurface,
  ): Stripe.AccountSessionCreateParams["components"] {
    const isOwnerAdmin = role === "owner" || role === "admin";
    const isFinance = role === "finance";

    if (surface === "onboarding") {
      if (!isOwnerAdmin) throw new Error("insufficient_role");
      return {
        account_onboarding: { enabled: true },
        notification_banner: { enabled: true },
      };
    }

    if (isOwnerAdmin || isFinance) {
      return {
        account_management: {
          enabled: true,
          features: { external_account_collection: true },
        },
        notification_banner: { enabled: true },
        balances: { enabled: true },
      };
    }

    throw new Error("insufficient_role");
  }

  async createAccountSession(
    legalEntityId: string,
    role: string,
    surface: ConnectSessionSurface,
  ): Promise<AccountSessionResult> {
    const stripe = this.requireStripe();
    const row = await this.loadEntity(legalEntityId);
    if (!row.stripeConnectAccountId) {
      throw new Error("stripe_account_missing");
    }

    const components = this.buildComponents(role, surface);
    const session = await stripe.accountSessions.create({
      account: row.stripeConnectAccountId,
      components,
    });

    if (!session.client_secret) {
      throw new Error("account_session_missing_client_secret");
    }

    return { clientSecret: session.client_secret };
  }
}
