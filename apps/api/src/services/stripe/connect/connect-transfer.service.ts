import type { Database } from "@auction/db";
import type { IConnectTransferRepository } from "@auction/persistence";
import type Stripe from "stripe";
import type { Env } from "../../../env.js";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import type { DomainEventPublisher } from "../../domain-event.publisher.js";
import type { IPayoutRepository } from "../../interfaces/payout-repository.js";
import type { IPayoutService } from "../../interfaces/payout.js";
import type {
  IConnectAccountReadinessSync,
  IConnectTransferInitiationService,
  InitiateTransferResult,
} from "../../interfaces/stripe-connect.js";
import { ConnectTransferInitiationService } from "./connect-transfer-initiation.service.js";
import { ConnectTransferWebhookService } from "./connect-transfer-webhook.service.js";

/** Thin coordinator composing transfer webhook reconciliation and initiation (SRP split). */
export class ConnectTransferService {
  private readonly webhookService: ConnectTransferWebhookService;
  readonly initiationService: IConnectTransferInitiationService;

  constructor(
    env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">,
    db: Database,
    stripeFactory: IStripeClientFactory,
    accountSync: IConnectAccountReadinessSync,
    payoutService: IPayoutService,
    connectTransferRepository: IConnectTransferRepository,
    payoutRepository?: IPayoutRepository,
    domainEventPublisher?: DomainEventPublisher,
  ) {
    this.webhookService = new ConnectTransferWebhookService(db, payoutService);
    this.initiationService = new ConnectTransferInitiationService(
      env,
      db,
      connectTransferRepository,
      stripeFactory,
      accountSync,
      payoutRepository,
      domainEventPublisher,
    );
  }

  handleTransferEvent(event: Stripe.Event): Promise<{ processed: boolean }> {
    return this.webhookService.handleTransferEvent(event);
  }

  initiateTransfer(
    payoutId: string,
    opts?: { keepScheduledOnTransferFailure?: boolean },
  ): Promise<InitiateTransferResult> {
    return this.initiationService.initiateTransfer(payoutId, opts);
  }
}
