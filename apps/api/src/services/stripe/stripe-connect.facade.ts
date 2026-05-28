import type { Database } from "@auction/db";
import type Stripe from "stripe";
import type { Env } from "../../env.js";
import { StripeClientFactory } from "../../lib/stripe-client.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IPayoutRepository } from "../interfaces/payout-repository.js";
import type { IPayoutService } from "../interfaces/payout.js";
import type {
  AccountLink,
  ConnectAccountStatus,
  CreateAccountResult,
  IStripeConnectService,
  InitiateTransferResult,
} from "../interfaces/stripe-connect.js";
import { ConnectAccountService } from "./connect/connect-account.service.js";
import { ConnectLifecyclePromoter } from "./connect/connect-lifecycle-promoter.js";
import { ConnectLinkService } from "./connect/connect-link.service.js";
import {
  type ConnectClientConfig,
  ConnectSessionService,
  type ConnectSessionSurface,
} from "./connect/connect-session.service.js";
import { ConnectTransferService } from "./connect/connect-transfer.service.js";
import { ConnectWebhookHandler } from "./connect/connect-webhook.handler.js";

/** Facade composing Connect sub-services (SRP split). */
export class StripeConnectFacade implements IStripeConnectService {
  private readonly accountService: ConnectAccountService;
  private readonly sessionService: ConnectSessionService;
  private readonly linkService: ConnectLinkService;
  private readonly webhookHandler: ConnectWebhookHandler;
  private readonly transferService: ConnectTransferService;

  constructor(
    env: Env,
    db: Database,
    payoutService: IPayoutService,
    payoutRepository?: IPayoutRepository,
    domainEventPublisher?: DomainEventPublisher,
    stripeFactory?: StripeClientFactory,
  ) {
    const factory = stripeFactory ?? new StripeClientFactory(env);
    const lifecyclePromoter = new ConnectLifecyclePromoter(domainEventPublisher);
    this.accountService = new ConnectAccountService(env, db, factory, lifecyclePromoter);
    this.sessionService = new ConnectSessionService(env, db, factory);
    this.linkService = new ConnectLinkService(env, db, factory);
    this.webhookHandler = new ConnectWebhookHandler(db, factory, this.accountService);
    this.transferService = new ConnectTransferService(
      env,
      db,
      factory,
      this.accountService,
      payoutService,
      payoutRepository,
      domainEventPublisher,
    );
  }

  isConfigured(): boolean {
    return this.sessionService.isConfigured();
  }

  getClientConfig(): ConnectClientConfig {
    return this.sessionService.getClientConfig();
  }

  createAccountSession(
    legalEntityId: string,
    role: string,
    surface: ConnectSessionSurface,
  ): Promise<{ clientSecret: string }> {
    return this.sessionService.createAccountSession(legalEntityId, role, surface);
  }

  ensureAccount(legalEntityId: string, country: string): Promise<CreateAccountResult> {
    return this.accountService.ensureAccount(legalEntityId, country);
  }

  getStatus(legalEntityId: string): Promise<ConnectAccountStatus> {
    return this.accountService.getStatus(legalEntityId);
  }

  syncAccountFromStripe(legalEntityId: string): Promise<ConnectAccountStatus> {
    return this.accountService.syncAccountFromStripe(legalEntityId);
  }

  createOnboardingLink(
    legalEntityId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<AccountLink> {
    return this.linkService.createOnboardingLink(legalEntityId, returnUrl, refreshUrl);
  }

  createDashboardLink(legalEntityId: string): Promise<AccountLink> {
    return this.linkService.createDashboardLink(legalEntityId);
  }

  handleConnectedAccountEvent(event: Stripe.Event): Promise<{ processed: boolean }> {
    return this.webhookHandler.handleConnectedAccountEvent(event);
  }

  handleTransferEvent(event: Stripe.Event): Promise<{ processed: boolean }> {
    return this.transferService.handleTransferEvent(event);
  }

  initiateTransfer(
    payoutId: string,
    opts?: { keepScheduledOnTransferFailure?: boolean },
  ): Promise<InitiateTransferResult> {
    return this.transferService.initiateTransfer(payoutId, opts);
  }
}
