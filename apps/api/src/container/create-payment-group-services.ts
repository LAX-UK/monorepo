import type { Database } from "@auction/db";
import type {
  ILotRepository,
  IPaymentWriteRepository,
  IPayoutRepository,
  ITransactionRunner,
  IUserRepository,
} from "@auction/persistence/interfaces";
import { DrizzlePaymentGroupRepository } from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import type { IStripeClientFactory } from "../lib/stripe-client.js";
import { tryClaimProcessedStripeEvent } from "../lib/stripe-processed-event.js";
import { recordMoneyPathEvent } from "../middleware/metrics.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { IInvoiceAccountingProvider } from "../services/interfaces/invoice-accounting.js";
import type { IPaymentCaptureInTransaction } from "../services/interfaces/payment-capture.js";
import type { IPayoutAdjustmentService } from "../services/interfaces/payout-adjustment.js";
import type { IStripeCustomerGateway } from "../services/interfaces/stripe-customer.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";
import { PaymentGroupChargeEvents } from "../services/payment-group/payment-group-charge-events.js";
import {
  type IGroupInvoiceAccounting,
  PaymentGroupCheckoutService,
} from "../services/payment-group/payment-group-checkout.service.js";
import { PaymentGroupReceiptNotifier } from "../services/payment-group/payment-group-receipt.notifier.js";
import {
  type IProviderEventClaim,
  PaymentGroupSettlementService,
} from "../services/payment-group/payment-group-settlement.service.js";
import { revokeOpenStripeCheckoutForPayment } from "../services/payment/checkout-orchestrator.js";
import { ensureXeroInvoiceForPayment } from "../services/payment/ensure-xero-invoice.js";
import { payoutRepoForTx } from "../services/payout/payout-helpers.js";
import type { PaymentGroupWebhookDeps } from "../services/stripe-webhook/create-payment-webhook-handlers.js";
import { PAYMENT_WEBHOOK_EVENT_SOURCE } from "../services/stripe-webhook/payment-webhook-types.js";
import type { IStripePaymentGateway } from "../services/stripe/stripe-payment-gateway.js";
import { StripePaymentGroupGateway } from "../services/stripe/stripe-payment-group.gateway.js";

export type PaymentGroupServices = {
  checkout: PaymentGroupCheckoutService;
  webhooks: PaymentGroupWebhookDeps;
};

export type CreatePaymentGroupServicesInput = {
  db: Database;
  env: Pick<Env, "WEB_ORIGIN" | "XERO_INVOICE_BLOCKING">;
  stripeClientFactory: IStripeClientFactory;
  transactionRunner: ITransactionRunner;
  payments: IPaymentWriteRepository;
  payouts: IPayoutRepository;
  payoutAdjustments: IPayoutAdjustmentService;
  capture: IPaymentCaptureInTransaction;
  events: IDomainEventSink;
  notificationDispatcher: Pick<NotificationDispatcher, "dispatch"> | null;
  users: IUserRepository;
  lots: Pick<ILotRepository, "findById">;
  accounting: IInvoiceAccountingProvider;
  stripePayments: IStripePaymentGateway;
  stripeCustomers: IStripeCustomerGateway;
};

/** Each invoice gets its accounting invoice first, as a single-invoice checkout does. */
function groupInvoiceAccounting(input: CreatePaymentGroupServicesInput): IGroupInvoiceAccounting {
  return {
    async ensureInvoices(paymentIds) {
      for (const paymentId of paymentIds) {
        const payment = await input.payments.findById(paymentId);
        const lot = payment ? await input.lots.findById(payment.lotId) : null;
        const buyerId = payment?.paidByUserId ?? payment?.buyerId;
        if (!payment || !lot || !buyerId) return false;
        const result = await ensureXeroInvoiceForPayment(
          input.accounting,
          input.users,
          paymentId,
          lot,
          buyerId,
          payment.amount,
        );
        if (!result.ok) {
          // As for one invoice: the retry job creates it later unless accounting must come first.
          if (input.env.XERO_INVOICE_BLOCKING) return false;
          recordMoneyPathEvent("xero_invoice_deferred");
        }
      }
      return true;
    },
  };
}

/** "Pay several": the combined checkout, its settlement and its charge events. */
export function createPaymentGroupServices(
  input: CreatePaymentGroupServicesInput,
): PaymentGroupServices {
  const groups = new DrizzlePaymentGroupRepository(input.db);
  const gateway = new StripePaymentGroupGateway(input.stripeClientFactory);
  const claims: IProviderEventClaim = {
    claim: async (tx, eventId) =>
      (await tryClaimProcessedStripeEvent(tx, eventId, PAYMENT_WEBHOOK_EVENT_SOURCE)).claimed,
  };
  const settlement = new PaymentGroupSettlementService({
    transactionRunner: input.transactionRunner,
    groups,
    payments: input.payments,
    capture: input.capture,
    events: input.events,
    claims,
    receipt: new PaymentGroupReceiptNotifier(input.notificationDispatcher),
  });
  const checkout = new PaymentGroupCheckoutService({
    groups,
    gateway,
    stripeCustomers: input.stripeCustomers,
    users: input.users,
    singleCheckouts: {
      revoke: (paymentId) =>
        revokeOpenStripeCheckoutForPayment(
          { payments: input.payments, stripePayments: input.stripePayments },
          paymentId,
        ),
    },
    accounting: groupInvoiceAccounting(input),
    settlement,
    events: input.events,
    webOrigin: input.env.WEB_ORIGIN,
  });
  const chargeEvents = new PaymentGroupChargeEvents({
    transactionRunner: input.transactionRunner,
    groups,
    gateway,
    payments: input.payments,
    payoutAdjustments: input.payoutAdjustments,
    refundedCentsSoFar: (tx, paymentId) =>
      payoutRepoForTx(input.payouts, tx).sumRefundLineCentsForPayment(paymentId),
    events: input.events,
    claims,
  });
  return {
    checkout,
    webhooks: { settlement, chargeEvents, groups, payments: input.payments, gateway },
  };
}
