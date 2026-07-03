import type { Database } from "@auction/db";
import type { IConnectTransferRepository } from "@auction/persistence";
import type { Redis } from "ioredis";
import type Stripe from "stripe";
import type { Env } from "../../env.js";
import { StripeClientFactory } from "../../lib/stripe-client.js";
import type { ILegalEntityConnectRepository } from "../../repositories/interfaces/legal-entity-connect.repository.js";
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
    connectTransferRepository: IConnectTransferRepository,
    legalEntityConnectRepository: ILegalEntityConnectRepository,
    payoutRepository?: IPayoutRepository,
    domainEventPublisher?: DomainEventPublisher,
    stripeFactory?: StripeClientFactory,
    redis?: Redis,
  ) {
    const factory = stripeFactory ?? new StripeClientFactory(env);
    const lifecyclePromoter = new ConnectLifecyclePromoter(
      legalEntityConnectRepository,
      domainEventPublisher,
    );
    this.accountService = new ConnectAccountService(
      env,
      db,
      legalEntityConnectRepository,
      legalEntityConnectRepository,
      factory,
      lifecyclePromoter,
      redis,
    );
    this.sessionService = new ConnectSessionService(env, legalEntityConnectRepository, factory);
    this.linkService = new ConnectLinkService(env, legalEntityConnectRepository, factory);
    this.webhookHandler = new ConnectWebhookHandler(db, factory, this.accountService);
    this.transferService = new ConnectTransferService(
      env,
      db,
      factory,
      this.accountService,
      payoutService,
      connectTransferRepository,
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

  ensureAccount(legalEntityId: string): Promise<CreateAccountResult> {
    return this.accountService.ensureAccount(legalEntityId);
  }

  getStatus(legalEntityId: string): Promise<ConnectAccountStatus> {
    return this.accountService.getStatus(legalEntityId);
  }

  syncAccountFromStripe(legalEntityId: string): Promise<ConnectAccountStatus> {
    return this.accountService.syncAccountFromStripe(legalEntityId);
  }

  applyAccountUpdate(account: Stripe.Account, db?: Database): Promise<void> {
    return this.accountService.applyAccountUpdate(account, db);
  }

  applyAccountDeauthorized(stripeAccountId: string, db?: Database): Promise<void> {
    return this.accountService.applyAccountDeauthorized(stripeAccountId, db);
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
