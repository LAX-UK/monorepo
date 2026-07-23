import type { IAdminStripeConnectApplicationService } from "../interfaces/admin-routes.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";

export class AdminStripeConnectApplicationService implements IAdminStripeConnectApplicationService {
  readonly webOrigin: string | undefined;

  constructor(
    private readonly stripe: IStripeConnectService,
    webOrigin: string | undefined,
  ) {
    this.webOrigin = webOrigin;
  }

  syncAccountFromStripe(...args: Parameters<IStripeConnectService["syncAccountFromStripe"]>) {
    return this.stripe.syncAccountFromStripe(...args);
  }

  createOnboardingLink(...args: Parameters<IStripeConnectService["createOnboardingLink"]>) {
    return this.stripe.createOnboardingLink(...args);
  }
}
