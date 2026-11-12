import { ArtworkOfferLock } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import type { DealInvoiceIssuer, PrivateSalePolicy } from "@auction/domain";
import type { IUnappliedMoneyRecorder } from "@auction/finance-runtime";
import type {
  IAmlHoldStore,
  IKycRepository,
  ILegalEntityMembershipReader,
  ISourceOfFundsRepository,
  ITransactionRunner,
  IUserRepository,
  IWatchlistScreeningReader,
} from "@auction/persistence/interfaces";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleDealWorkStore,
  DrizzleMarketingEnquiryRepository,
  DrizzlePrivateSaleDealFinanceStore,
  DrizzlePrivateSaleDealPaymentRepository,
  DrizzlePrivateSaleDealPayoutStore,
  DrizzlePrivateSaleDealQueryRepository,
  DrizzlePrivateSaleDealRepository,
} from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import type { IStripeClientFactory } from "../lib/stripe-client.js";
import { tryClaimProcessedStripeEvent } from "../lib/stripe-processed-event.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type {
  IEnquiryConversion,
  IPrivateSaleDealDesk,
  IPrivateSaleDealParties,
} from "../services/interfaces/private-sale-deal-desk.js";
import type { IStripeCustomerGateway } from "../services/interfaces/stripe-customer.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";
import type { IProviderEventClaim } from "../services/payment-group/payment-group-settlement.service.js";
import type { PaymentTierPolicy } from "../services/payment/payment-tier.policy.js";
import { ComplianceDealClearanceReader } from "../services/private-sale-deal/deal-clearance.reader.js";
import { PrivateSaleDealCommandService } from "../services/private-sale-deal/deal-command.service.js";
import { PrivateSaleDealDesk } from "../services/private-sale-deal/deal-desk.js";
import { DealInvoiceService } from "../services/private-sale-deal/deal-invoice.service.js";
import { DealPartyResolver } from "../services/private-sale-deal/deal-party-resolver.js";
import { PrivateSaleDealPartyService } from "../services/private-sale-deal/deal-party.service.js";
import {
  type DealPaymentScope,
  DealPaymentSettlementService,
} from "../services/private-sale-deal/deal-payment-settlement.service.js";
import { DealPaymentService } from "../services/private-sale-deal/deal-payment.service.js";
import { DealPayoutSettlementService } from "../services/private-sale-deal/deal-payout-settlement.service.js";
import { PrivateSaleDealQueryService } from "../services/private-sale-deal/deal-query.service.js";
import { DealReceiptNotifier } from "../services/private-sale-deal/deal-receipt.notifier.js";
import { ArtworkRegisterDealLock } from "../services/private-sale-deal/deal-register-lock.js";
import { DealReversalService } from "../services/private-sale-deal/deal-reversal.service.js";
import { DealTransferService } from "../services/private-sale-deal/deal-transfer.service.js";
import { DealTransitionService } from "../services/private-sale-deal/deal-transition.service.js";
import { EnquiryConversionService } from "../services/private-sale-deal/enquiry-conversion.service.js";
import { privateSalePolicyFromEnv } from "../services/private-sale-deal/private-sale-policy.config.js";
import { UserRepositoryActorNames } from "../services/private-sale-deal/user-repository-actor-names.js";
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
  /** Staff work on deals: the lists, the record and every move. */
  desk: IPrivateSaleDealDesk;
  /** A private sale enquiry becomes a proposed deal. */
  conversion: IEnquiryConversion;
  /** A buyer's and a seller's own deals. */
  parties: IPrivateSaleDealParties;
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
  memberships: Pick<ILegalEntityMembershipReader, "findActiveMembership" | "ensurePersonalEntity">;
  kyc: IKycRepository;
  amlHolds: IAmlHoldStore;
  screenings: IWatchlistScreeningReader;
  sourceOfFunds: ISourceOfFundsRepository;
  /**
   * The finance system that issues invoices. There is none yet: invoices will come only from
   * the accounting system the business has chosen, so no production implementation exists.
   */
  invoiceIssuer?: DealInvoiceIssuer | null;
  /** Sends the buyer's receipt; absent where notices are not sent. */
  notificationDispatcher?: Pick<NotificationDispatcher, "dispatch"> | null;
  /** The finance task and alert for money that could not be applied. */
  unappliedMoney: Pick<IUnappliedMoneyRecorder, "record">;
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
  const registerForTx = (executor: Database) =>
    new ArtworkRegisterDealLock<Database>(
      executor,
      (session) =>
        new ArtworkOfferLock(new DrizzleArtworkRegisterRepository(db).withExecutor(session)),
    );
  const transitionScopeForTx = (tx: Database) => ({
    deals: new DrizzlePrivateSaleDealRepository(tx),
    events: events.withTx(tx),
    register: registerForTx(tx),
  });
  const transitions = new DealTransitionService({
    scope: { deals, events },
    inTransaction: { runner: input.transactionRunner, scopeForTx: transitionScopeForTx },
    clearance,
    policy,
  });
  const scopeForTx = (tx: Database): DealPaymentScope => ({
    ...transitionScopeForTx(tx),
    payments: new DrizzlePrivateSaleDealPaymentRepository(tx),
  });
  const claims: IProviderEventClaim = {
    claim: async (tx, eventId) =>
      (await tryClaimProcessedStripeEvent(tx, eventId, PAYMENT_WEBHOOK_EVENT_SOURCE)).claimed,
  };
  const queries = new DrizzlePrivateSaleDealQueryRepository(db);
  const settlement = new DealPaymentSettlementService({
    transactionRunner: input.transactionRunner,
    scopeForTx,
    transitions,
    claims,
    unappliedMoney: input.unappliedMoney,
    payouts,
    receipt: new DealReceiptNotifier({
      payments,
      deals,
      works: queries,
      dispatcher: input.notificationDispatcher ?? null,
    }),
  });
  const gateway = new StripeDealCheckoutGateway(input.stripeClientFactory);
  const invoices = new DealInvoiceService({
    transitions,
    finance,
    issuer: input.invoiceIssuer ?? null,
  });
  const dealPayments = new DealPaymentService({
    deals,
    payments,
    clearance,
    tiers: input.tiers,
    gateway,
    stripeCustomers: input.stripeCustomers,
    users: input.users,
    events,
    webOrigin: env.WEB_ORIGIN,
  });
  const reversal = new DealReversalService({
    deals,
    payments,
    payouts,
    refunds: input.stripePayments,
    checkout: gateway,
    settlement,
    transitions,
    transactionRunner: input.transactionRunner,
    scopeForTx,
  });
  const transfers = new DealTransferService({ deals, payments, checkout: gateway, settlement });
  const parties = new DealPartyResolver({
    memberships: input.memberships,
    users: input.users,
  });
  const enquiries = new DrizzleMarketingEnquiryRepository(db);

  const deskQueries = new PrivateSaleDealQueryService({
    deals,
    queries,
    payments,
    payouts,
    transitions,
    clearance,
    policy,
    enquiries,
    names: new UserRepositoryActorNames(input.users),
  });
  const deskCommands = new PrivateSaleDealCommandService({
    deals,
    payments,
    transitions,
    invoices,
    reversal,
    transfers,
    policy,
    parties,
    events,
    records: deskQueries,
  });

  return {
    policy,
    transitions,
    invoices,
    payments: dealPayments,
    reversal,
    payoutSettlement: new DealPayoutSettlementService({ payouts, transitions }),
    webhooks: { settlement, payments },
    desk: new PrivateSaleDealDesk(deskQueries, deskCommands),
    conversion: new EnquiryConversionService({
      enquiries,
      works: new DrizzleDealWorkStore(db),
      openDeals: queries,
      dealsForTx: (tx) => new DrizzlePrivateSaleDealRepository(tx),
      artworks: new DrizzleArtworkRegisterRepository(db),
      registerForTx,
      parties,
      policy,
      transactionRunner: input.transactionRunner,
      events,
    }),
    parties: new PrivateSaleDealPartyService({
      deals,
      queries,
      clearance,
      policy,
      memberships: input.memberships,
      payments: dealPayments,
      events,
    }),
  };
}
