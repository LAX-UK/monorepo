import type { Database } from "@auction/db";
import type { DealInvoiceIssuer, PrivateSalePolicy } from "@auction/domain";
import type {
  IAmlHoldStore,
  IKycRepository,
  ISourceOfFundsRepository,
  ITransactionRunner,
  IUserRepository,
  IWatchlistScreeningReader,
} from "@auction/persistence/interfaces";
import {
  DrizzlePrivateSaleDealFinanceStore,
  DrizzlePrivateSaleDealPaymentRepository,
  DrizzlePrivateSaleDealPayoutStore,
  DrizzlePrivateSaleDealRepository,
} from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import type { IStripeClientFactory } from "../lib/stripe-client.js";
import { tryClaimProcessedStripeEvent } from "../lib/stripe-processed-event.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { IStripeCustomerGateway } from "../services/interfaces/stripe-customer.js";
import type { IProviderEventClaim } from "../services/payment-group/payment-group-settlement.service.js";
import type { PaymentTierPolicy } from "../services/payment/payment-tier.policy.js";
import { ComplianceDealClearanceReader } from "../services/private-sale-deal/deal-clearance.reader.js";
import { DealInvoiceService } from "../services/private-sale-deal/deal-invoice.service.js";
import {
  type DealPaymentScope,
  DealPaymentSettlementService,
} from "../services/private-sale-deal/deal-payment-settlement.service.js";
import { DealPaymentService } from "../services/private-sale-deal/deal-payment.service.js";
import { DealPayoutSettlementService } from "../services/private-sale-deal/deal-payout-settlement.service.js";
import { DealReversalService } from "../services/private-sale-deal/deal-reversal.service.js";
import { DealTransitionService } from "../services/private-sale-deal/deal-transition.service.js";
import { privateSalePolicyFromEnv } from "../services/private-sale-deal/private-sale-policy.config.js";
import type { DealPaymentWebhookDeps } from "../services/stripe-webhook/deal-payment-webhook-handlers.js";
import { PAYMENT_WEBHOOK_EVENT_SOURCE } from "../services/stripe-webhook/payment-webhook-types.js";
import { StripeDealCheckoutGateway } from "../services/stripe/stripe-deal-checkout.gateway.js";
import type { IStripePaymentGateway } from "../services/stripe/stripe-payment-gateway.js";

export type PrivateSaleDealServices = {
  policy: PrivateSalePolicy;
  transitions: DealTransitionService;
  invoices: DealInvoiceService;
  payments: DealPaymentService;
  reversal: DealReversalService;
  payoutSettlement: DealPayoutSettlementService;
  webhooks: DealPaymentWebhookDeps;
};

export type CreatePrivateSaleDealServicesInput = {
  db: Database;
  env: Env;
  stripeClientFactory: IStripeClientFactory;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  tiers: PaymentTierPolicy;
  stripePayments: IStripePaymentGateway;
  stripeCustomers: IStripeCustomerGateway;
  users: IUserRepository;
  kyc: IKycRepository;
  amlHolds: IAmlHoldStore;
  screenings: IWatchlistScreeningReader;
  sourceOfFunds: ISourceOfFundsRepository;
  /**
   * The finance system that issues invoices. There is none yet: invoices will come only from
   * the accounting system the business has chosen, so no production implementation exists.
   */
  invoiceIssuer?: DealInvoiceIssuer | null;
};

/** Private sale deals: the state machine, the buyer's payment, refunds and the seller's payout. */
export function createPrivateSaleDealServices(
  input: CreatePrivateSaleDealServicesInput,
): PrivateSaleDealServices {
  const { db, env, events } = input;
  const policy = privateSalePolicyFromEnv(env);
  const deals = new DrizzlePrivateSaleDealRepository(db);
  const payments = new DrizzlePrivateSaleDealPaymentRepository(db);
  const finance = new DrizzlePrivateSaleDealFinanceStore(db);
  const payouts = new DrizzlePrivateSaleDealPayoutStore(db);

  const clearance = new ComplianceDealClearanceReader({
    kyc: input.kyc,
    amlHolds: input.amlHolds,
    screenings: input.screenings,
    sourceOfFunds: input.sourceOfFunds,
    deals: finance,
    sourceOfFundsValidityDays: env.SOF_APPROVAL_VALIDITY_DAYS,
  });
  const transitions = new DealTransitionService({
    scope: { deals, events },
    clearance,
    policy,
  });
  const scopeForTx = (tx: Database): DealPaymentScope => ({
    deals: new DrizzlePrivateSaleDealRepository(tx),
    payments: new DrizzlePrivateSaleDealPaymentRepository(tx),
    events: events.withTx(tx),
  });
  const claims: IProviderEventClaim = {
    claim: async (tx, eventId) =>
      (await tryClaimProcessedStripeEvent(tx, eventId, PAYMENT_WEBHOOK_EVENT_SOURCE)).claimed,
  };
  const settlement = new DealPaymentSettlementService({
    transactionRunner: input.transactionRunner,
    scopeForTx,
    transitions,
    claims,
  });
  const gateway = new StripeDealCheckoutGateway(input.stripeClientFactory);

  return {
    policy,
    transitions,
    invoices: new DealInvoiceService({
      transitions,
      finance,
      issuer: input.invoiceIssuer ?? null,
    }),
    payments: new DealPaymentService({
      deals,
      payments,
      clearance,
      tiers: input.tiers,
      gateway,
      stripeCustomers: input.stripeCustomers,
      users: input.users,
      events,
      webOrigin: env.WEB_ORIGIN,
    }),
    reversal: new DealReversalService({
      deals,
      payments,
      payouts,
      refunds: input.stripePayments,
      checkout: gateway,
      settlement,
      transitions,
      transactionRunner: input.transactionRunner,
      scopeForTx,
    }),
    payoutSettlement: new DealPayoutSettlementService({ payouts, transitions }),
    webhooks: { settlement, payments },
  };
}
