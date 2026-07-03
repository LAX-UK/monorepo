import type { Env } from "../../../env.js";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { assertConnectUrlAllowed } from "../../../lib/stripe-connect-return-url.js";
import type { ILegalEntityConnectReader } from "../../../repositories/interfaces/legal-entity-connect.reader.js";
import type { AccountLink } from "../../interfaces/stripe-connect.js";
import { throwConnectError } from "./connect-service-errors.js";
import { loadConnectLegalEntity, requireConnectStripe } from "./connect-shared.js";

export class ConnectLinkService {
  private readonly webOrigin: string;
  private readonly failClosedOriginCheck: boolean;

  constructor(
    env: Env,
    private readonly connectReader: ILegalEntityConnectReader,
    private readonly stripeFactory: IStripeClientFactory,
  ) {
    this.webOrigin = env.WEB_ORIGIN.replace(/\/$/, "");
    this.failClosedOriginCheck = env.NODE_ENV === "production";
  }

  async createOnboardingLink(
    legalEntityId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<AccountLink> {
    assertConnectUrlAllowed(returnUrl, this.webOrigin, {
      failClosed: this.failClosedOriginCheck,
    });
    assertConnectUrlAllowed(refreshUrl, this.webOrigin, {
      failClosed: this.failClosedOriginCheck,
    });
    const stripe = requireConnectStripe(this.stripeFactory);
    const row = await loadConnectLegalEntity(this.connectReader, legalEntityId);
    if (!row.stripeConnectAccountId) {
      throwConnectError("stripe_account_missing", 400);
    }
    const link = await stripe.accountLinks.create({
      account: row.stripeConnectAccountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return { url: link.url, expiresAt: new Date(link.expires_at * 1000) };
  }

  async createDashboardLink(_legalEntityId: string): Promise<AccountLink> {
    // Accounts use controller.stripe_dashboard.type=none — login links require Express dashboard.
    throwConnectError("dashboard_link_not_supported", 400);
  }
}
