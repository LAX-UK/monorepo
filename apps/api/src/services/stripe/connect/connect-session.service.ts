import type { ILegalEntityConnectReader } from "@auction/persistence/interfaces";
import {
  type ConnectAccountSessionComponents,
  type ConnectSessionSurface,
  connectSessionComponents,
  createConnectAccountSession,
} from "@auction/stripe-connect";
import type Stripe from "stripe";
import type { Env } from "../../../env.js";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { StripeConnectNotConfiguredError } from "../../interfaces/stripe-connect.js";
import { throwConnectError } from "./connect-service-errors.js";
import { loadConnectLegalEntity, requireConnectStripe } from "./connect-shared.js";

export type { ConnectSessionSurface };

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
    private readonly connectReader: ILegalEntityConnectReader,
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

  private buildComponents(
    role: string,
    surface: ConnectSessionSurface,
  ): ConnectAccountSessionComponents {
    const isOwnerAdmin = role === "owner" || role === "admin";
    const isFinance = role === "finance";

    if (surface === "onboarding") {
      if (!isOwnerAdmin) throwConnectError("insufficient_role", 403);
      return connectSessionComponents("onboarding");
    }

    if (isOwnerAdmin || isFinance) {
      return connectSessionComponents("management");
    }

    throwConnectError("insufficient_role", 403);
  }

  async createAccountSession(
    legalEntityId: string,
    role: string,
    surface: ConnectSessionSurface,
  ): Promise<AccountSessionResult> {
    const stripe = requireConnectStripe(this.stripeFactory);
    const row = await loadConnectLegalEntity(this.connectReader, legalEntityId);
    if (!row.stripeConnectAccountId) {
      throwConnectError("stripe_account_missing", 400);
    }

    const components = this.buildComponents(role, surface);
    const clientSecret = await createConnectAccountSession(stripe, {
      accountId: row.stripeConnectAccountId,
      components,
    });

    if (!clientSecret) {
      throwConnectError("account_session_missing_client_secret", 502);
    }

    return { clientSecret };
  }
}

// StripeConnectNotConfiguredError is thrown by requireConnectStripe via factory — re-export for callers.
export { StripeConnectNotConfiguredError };
