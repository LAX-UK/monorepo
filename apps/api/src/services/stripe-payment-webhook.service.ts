import type {
  IPaymentWebhookLookupReader,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type {
  IPaymentRefundLedger,
  IPaymentWriteRepository,
} from "@auction/persistence/interfaces";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import type { IDisputeWebhookRecorder } from "./disputes/dispute-case-recorder.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IErrorReporter } from "./interfaces/error-handling.js";
import type { IPaymentCaptureService } from "./interfaces/payment-capture.js";
import type { IPayoutAdjustmentService } from "./interfaces/payout-adjustment.js";
import {
  type IUnappliedMoneyRecorder,
  NO_UNAPPLIED_MONEY_RECORDER,
} from "./payment/unapplied-money.recorder.js";
import {
  type TransferCheckDeps,
  handleCashBalanceTransactionCreated,
} from "./stripe-webhook/cash-balance-transaction.handler.js";
import { handleChargeRefunded } from "./stripe-webhook/checkout-refund-handlers.js";
import {
  type PaymentGroupWebhookDeps,
  createPaymentWebhookHandlers,
} from "./stripe-webhook/create-payment-webhook-handlers.js";
import { handleCustomerBalanceFundsAvailable } from "./stripe-webhook/customer-balance-unapplied.handler.js";
import {
  type DealPaymentWebhookDeps,
  dealChargeRefunded,
  withDealPaymentHandlers,
} from "./stripe-webhook/deal-payment-webhook-handlers.js";
import type { StripePaymentWebhookDeps } from "./stripe-webhook/payment-webhook-lookup.js";
import type { PaymentWebhookResult } from "./stripe-webhook/payment-webhook-types.js";
import {
  PaymentIntentRequiresActionHandler,
  ReferenceNotingHandler,
} from "./stripe-webhook/transfer-reference.js";
import type { UnappliedMoneyRefundHandler } from "./stripe-webhook/unapplied-money-refund.handler.js";

export type { PaymentWebhookResult } from "./stripe-webhook/payment-webhook-types.js";

import type { IPaymentEligibilityGate } from "@auction/finance-runtime";

/** Without the refund record no refund can be measured or kept, so the webhook fails and is retried. */
const UNWIRED_PAYMENT_REFUNDS: IPaymentRefundLedger = {
  recordInTransaction: () => Promise.reject(new Error("Payment refunds are not wired")),
  lockPaymentInTransaction: () => Promise.reject(new Error("Payment refunds are not wired")),
  sumRefundedPenceInTransaction: () => Promise.reject(new Error("Payment refunds are not wired")),
};

/** Routes Stripe payment webhooks to segregated handlers (no business logic). */
export class StripePaymentWebhookService {
  private readonly deps: StripePaymentWebhookDeps;
  private readonly handlers: ReturnType<typeof createPaymentWebhookHandlers>;
  private readonly requiresAction: PaymentIntentRequiresActionHandler | null;

  constructor(
    transactionRunner: ITransactionRunner,
    paymentWebhookLookup: IPaymentWebhookLookupReader,
    payments: IPaymentWriteRepository,
    payoutRepository: IPayoutRepository,
    payoutAdjustments: IPayoutAdjustmentService,
    paymentCapture: IPaymentCaptureService,
    domainEventSink: IDomainEventSink,
    private readonly disputes: IDisputeWebhookRecorder,
    private readonly paymentGroups: PaymentGroupWebhookDeps | null = null,
    private readonly dealPayments: DealPaymentWebhookDeps | null = null,
    unappliedMoney: IUnappliedMoneyRecorder | null = null,
    private readonly unappliedRefunds: UnappliedMoneyRefundHandler | null = null,
    paymentEligibility: IPaymentEligibilityGate | null = null,
    paymentRefunds: IPaymentRefundLedger | null = null,
    errorReporter?: IErrorReporter,
    private readonly transferChecks: TransferCheckDeps | null = null,
  ) {
    this.deps = {
      transactionRunner,
      paymentWebhookLookup,
      payments,
      payoutRepository,
      paymentRefunds: paymentRefunds ?? UNWIRED_PAYMENT_REFUNDS,
      payoutAdjustments,
      paymentCapture,
      domainEventSink,
      unappliedMoney: unappliedMoney ?? NO_UNAPPLIED_MONEY_RECORDER,
      paymentEligibility,
      ...(errorReporter ? { errorReporter } : {}),
    };
    const handlers = createPaymentWebhookHandlers(this.deps, paymentGroups);
    const routed = dealPayments ? withDealPaymentHandlers(handlers, dealPayments) : handlers;
    const references = transferChecks?.references;
    this.handlers = references
      ? {
          ...routed,
          paymentIntentProcessing: new ReferenceNotingHandler(
            routed.paymentIntentProcessing,
            references,
          ),
          paymentIntentPartiallyFunded: new ReferenceNotingHandler(
            routed.paymentIntentPartiallyFunded,
            references,
          ),
        }
      : routed;
    this.requiresAction = references ? new PaymentIntentRequiresActionHandler(references) : null;
  }

  /** A bank-transfer intent shows its transfer instructions: the reference is kept. */
  async handlePaymentIntentRequiresAction(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    if (!this.requiresAction) return { processed: false };
    return this.requiresAction.handle(event, paymentIntent);
  }

  async handlePaymentIntentSucceeded(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.paymentIntentSucceeded.handle(event, paymentIntent);
  }

  async handlePaymentIntentProcessing(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.paymentIntentProcessing.handle(event, paymentIntent);
  }

  async handlePaymentIntentPartiallyFunded(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.paymentIntentPartiallyFunded.handle(event, paymentIntent);
  }

  async handlePaymentIntentFailed(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.paymentIntentFailed.handle(event, paymentIntent);
  }

  async handlePaymentIntentCanceled(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.paymentIntentCanceled.handle(event, paymentIntent);
  }

  async handleCheckoutSessionAsyncPaymentFailed(
    event: Stripe.Event,
    session: Stripe.Checkout.Session,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.checkoutSessionAsyncPaymentFailed.handle(event, session);
  }

  async handleCheckoutSessionExpired(
    event: Stripe.Event,
    session: Stripe.Checkout.Session,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.checkoutSessionExpired.handle(event, session);
  }

  handleDisputeCreated(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    return this.disputes.record("created", event, dispute);
  }

  handleDisputeUpdated(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    return this.disputes.record("updated", event, dispute);
  }

  handleDisputeFundsWithdrawn(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    return this.disputes.record("funds_withdrawn", event, dispute);
  }

  handleDisputeFundsReinstated(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    return this.disputes.record("funds_reinstated", event, dispute);
  }

  handleDisputeClosed(event: Stripe.Event, dispute: Stripe.Dispute): Promise<PaymentWebhookResult> {
    return this.disputes.record("closed", event, dispute);
  }

  async handleChargeRefunded(
    event: Stripe.Event,
    charge: Stripe.Charge,
  ): Promise<PaymentWebhookResult> {
    const unapplied = await this.unappliedRefunds?.handle(event, charge);
    if (unapplied) return unapplied;
    const deal = this.dealPayments
      ? await dealChargeRefunded(this.dealPayments, event, charge)
      : null;
    if (deal) return deal;
    const grouped = await this.paymentGroups?.chargeEvents.chargeRefunded(event, charge);
    return grouped ?? handleChargeRefunded(this.deps, event, charge);
  }

  /** Money moved in a buyer's transfer balance: checked for a transfer applied to another invoice. */
  async handleCashBalanceTransactionCreated(
    event: Stripe.Event,
    txn: Stripe.CustomerCashBalanceTransaction,
  ): Promise<PaymentWebhookResult> {
    if (!this.transferChecks) return { processed: false };
    return handleCashBalanceTransactionCreated(this.deps, this.transferChecks, event, txn);
  }

  /** A bank transfer reached the buyer's Stripe balance and Stripe could not apply it. */
  handleCashBalanceFundsAvailable(
    event: Stripe.Event,
    balance: Stripe.CashBalance,
  ): Promise<PaymentWebhookResult> {
    return handleCustomerBalanceFundsAvailable(
      this.deps,
      event,
      balance,
      this.paymentGroups?.groups ?? null,
    );
  }
}
