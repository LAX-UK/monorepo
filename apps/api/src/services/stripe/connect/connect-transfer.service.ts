import { ConnectTransferInitiationService } from "@auction/finance-runtime";
import type {
  IConnectTransferRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import type { Env } from "../../../env.js";
import { createBaseLogger } from "../../../lib/logger.js";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { recordMoneyPathEvent } from "../../../middleware/metrics.js";
import type { IDomainEventSink } from "../../domain-event-sink.js";
import type { IPayoutService } from "../../interfaces/payout.js";
import type {
  IConnectAccountReadinessSync,
  IConnectTransferInitiationService,
  InitiateTransferOptions,
  InitiateTransferResult,
  TransferAdoptionVerification,
} from "../../interfaces/stripe-connect.js";
import { ConnectTransferWebhookService } from "./connect-transfer-webhook.service.js";

/** Thin coordinator composing transfer webhook reconciliation and initiation (SRP split). */
export class ConnectTransferService {
  private readonly webhookService: ConnectTransferWebhookService;
  readonly initiationService: IConnectTransferInitiationService;

  constructor(
    env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">,
    transactionRunner: ITransactionRunner,
    stripeFactory: IStripeClientFactory,
    accountSync: IConnectAccountReadinessSync,
    payoutService: IPayoutService,
    connectTransferRepository: IConnectTransferRepository,
    payoutRepository?: IPayoutRepository,
    domainEventSink?: IDomainEventSink,
  ) {
    this.webhookService = new ConnectTransferWebhookService(transactionRunner, payoutService);
    this.initiationService = new ConnectTransferInitiationService(
      createBaseLogger(env),
      connectTransferRepository,
      stripeFactory,
      accountSync,
      payoutRepository,
      domainEventSink,
      { record: recordMoneyPathEvent },
      { runner: transactionRunner },
    );
  }

  handleTransferEvent(event: Stripe.Event): Promise<{ processed: boolean }> {
    return this.webhookService.handleTransferEvent(event);
  }

  initiateTransfer(
    payoutId: string,
    opts?: InitiateTransferOptions,
  ): Promise<InitiateTransferResult> {
    return this.initiationService.initiateTransfer(payoutId, opts);
  }

  verifyTransferForAdoption(
    payoutId: string,
    stripeTransferId: string,
  ): Promise<TransferAdoptionVerification> {
    return this.initiationService.verifyTransferForAdoption(payoutId, stripeTransferId);
  }
}
