import type { IAdminStripeConnectApplicationService } from "../interfaces/admin-routes.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";

export class AdminStripeConnectApplicationService implements IAdminStripeConnectApplicationService {
  constructor(private readonly stripe: IStripeConnectService) {}

  applyAccountUpdate(...args: Parameters<IStripeConnectService["applyAccountUpdate"]>) {
    return this.stripe.applyAccountUpdate(...args);
  }

  applyAccountDeauthorized(...args: Parameters<IStripeConnectService["applyAccountDeauthorized"]>) {
    return this.stripe.applyAccountDeauthorized(...args);
  }

  ensureAccount(...args: Parameters<IStripeConnectService["ensureAccount"]>) {
    return this.stripe.ensureAccount(...args);
  }

  getStatus(...args: Parameters<IStripeConnectService["getStatus"]>) {
    return this.stripe.getStatus(...args);
  }

  syncAccountFromStripe(...args: Parameters<IStripeConnectService["syncAccountFromStripe"]>) {
    return this.stripe.syncAccountFromStripe(...args);
  }

  createOnboardingLink(...args: Parameters<IStripeConnectService["createOnboardingLink"]>) {
    return this.stripe.createOnboardingLink(...args);
  }

  createDashboardLink(...args: Parameters<IStripeConnectService["createDashboardLink"]>) {
    return this.stripe.createDashboardLink(...args);
  }

  handleConnectedAccountEvent(
    ...args: Parameters<IStripeConnectService["handleConnectedAccountEvent"]>
  ) {
    return this.stripe.handleConnectedAccountEvent(...args);
  }

  isConfigured(...args: Parameters<IStripeConnectService["isConfigured"]>) {
    return this.stripe.isConfigured(...args);
  }

  getClientConfig(...args: Parameters<IStripeConnectService["getClientConfig"]>) {
    return this.stripe.getClientConfig(...args);
  }

  createAccountSession(...args: Parameters<IStripeConnectService["createAccountSession"]>) {
    return this.stripe.createAccountSession(...args);
  }

  handleTransferEvent(...args: Parameters<IStripeConnectService["handleTransferEvent"]>) {
    return this.stripe.handleTransferEvent(...args);
  }

  initiateTransfer(...args: Parameters<IStripeConnectService["initiateTransfer"]>) {
    return this.stripe.initiateTransfer(...args);
  }
}
