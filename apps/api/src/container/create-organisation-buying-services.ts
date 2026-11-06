import { SITE_CONTACT_EMAIL, legalEntityFor } from "@auction/branding";
import type { Database } from "@auction/db";
import type { PaymentTierLimits } from "@auction/domain";
import type { InvoiceRaiser, LotInvoiceInitiationService } from "@auction/finance-runtime";
import type {
  IBidInvoiceReader,
  ILegalEntityRepository,
  ILotRepository,
  ISaleRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import {
  DrizzleAccountPurchaseFactsReader,
  DrizzleAccountRegistrationsReader,
  DrizzleDeliveryQuoteRepository,
  DrizzlePaySeveralInvoiceFlagsReader,
  DrizzlePurchaseProblemRepository,
} from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import type {
  ISettlementComplianceAssessor,
  ISettlementCompliancePolicy,
} from "../services/aml/settlement-compliance.policy.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { INotificationFactory } from "../services/interfaces/notification-factory.js";
import type {
  IAccountPurchasesService,
  IAccountRegistrationsService,
  ICollectionBookingService,
  IDeliveryQuoteService,
  IPayPlanService,
  IPaySeveralService,
  IPurchaseProblemService,
  IStaffDeliveryQuoteService,
} from "../services/interfaces/organisation-buying-service.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";
import { AccountPurchasesService } from "../services/organisation-buying/account-purchases.service.js";
import { AccountRegistrationsService } from "../services/organisation-buying/account-registrations.service.js";
import { CollectionBookingService } from "../services/organisation-buying/collection-booking.service.js";
import { DeliveryQuoteReadyNotifier } from "../services/organisation-buying/delivery-quote-ready-notifier.js";
import {
  DeliveryQuoteService,
  StaffDeliveryQuoteService,
} from "../services/organisation-buying/delivery-quote.service.js";
import { PayPlanService } from "../services/organisation-buying/pay-plan.service.js";
import { PaySeveralService } from "../services/organisation-buying/pay-several.service.js";
import { PurchaseCandidateReader } from "../services/organisation-buying/purchase-candidate.reader.js";
import { PurchaseProblemService } from "../services/organisation-buying/purchase-problem.service.js";
import { WonLotLookups } from "../services/organisation-buying/won-lot-lookups.js";
import type { PaymentGroupCheckoutService } from "../services/payment-group/payment-group-checkout.service.js";
import type { IPaymentEligibilityGate } from "../services/payment/payment-eligibility.gate.js";

/** The client workspace's buying modules for the acting account. */
export type OrganisationBuyingServices = {
  registrations: IAccountRegistrationsService;
  purchases: IAccountPurchasesService;
  payPlan: IPayPlanService;
  paySeveral: IPaySeveralService;
  deliveryQuotes: IDeliveryQuoteService;
  collection: ICollectionBookingService;
  problems: IPurchaseProblemService;
};

export type CreateOrganisationBuyingInput = {
  db: Database;
  env: Pick<
    Env,
    | "COLLECTION_SELF_SERVE_ENABLED"
    | "COLLECTION_SLOT_CAPACITY_PER_HOUR"
    | "COLLECTION_HOURS"
    | "COLLECTION_BOOKING_EMAIL"
  >;
  lots: Pick<ILotRepository, "findById">;
  sales: Pick<ISaleRepository, "findById">;
  accounts: Pick<ILegalEntityRepository, "findById">;
  /** Whether a person has finished account setup; the pay plan reports it as a gate. */
  onboarding: { isComplete(userId: string): Promise<boolean> };
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  notificationDispatcher: Pick<NotificationDispatcher, "dispatch">;
  notificationFactory: Pick<INotificationFactory, "createDeliveryQuoteReady">;
  /** What paying several invoices at once needs from the payments side. */
  payments: {
    tierLimits: PaymentTierLimits;
    compliance:
      | (Pick<ISettlementCompliancePolicy, "peek" | "evaluate"> & ISettlementComplianceAssessor)
      | null;
    eligibility: IPaymentEligibilityGate;
    groupCheckout: Pick<PaymentGroupCheckoutService, "start">;
    invoices: IBidInvoiceReader;
    /** Prices a lot not invoiced yet with the calculator that raises invoices. */
    pricing: Pick<InvoiceRaiser, "price">;
    /** Raises the invoice of a won lot that has none yet, as lot end does. */
    invoiceInitiation: Pick<LotInvoiceInitiationService, "ensureForLot">;
  };
};

export function createOrganisationBuyingServices(input: CreateOrganisationBuyingInput): {
  client: OrganisationBuyingServices;
  staffDeliveryQuotes: IStaffDeliveryQuoteService;
} {
  const purchases = new DrizzleAccountPurchaseFactsReader(input.db);
  const quotes = new DrizzleDeliveryQuoteRepository(input.db);
  const lookups = new WonLotLookups(input.lots, input.sales);
  const candidates = new PurchaseCandidateReader({
    reader: purchases,
    flags: new DrizzlePaySeveralInvoiceFlagsReader(input.db),
    now: () => new Date(),
  });
  const bid = legalEntityFor("bid");
  const payPlan = new PayPlanService({
    candidates,
    invoices: input.payments.invoices,
    pricing: input.payments.pricing,
    lots: input.lots,
    accounts: input.accounts,
    onboarding: input.onboarding,
    eligibility: input.payments.eligibility,
    compliance: input.payments.compliance,
    limits: input.payments.tierLimits,
    issuer: {
      name: bid.name,
      address: bid.registeredAddress.inline,
      companyNumber: bid.companyNumber ?? null,
      vatNumber: bid.vatNumber ?? null,
    },
    now: () => new Date(),
  });
  return {
    client: {
      registrations: new AccountRegistrationsService(
        new DrizzleAccountRegistrationsReader(input.db),
      ),
      purchases: new AccountPurchasesService({ reader: purchases, now: () => new Date() }),
      payPlan,
      paySeveral: new PaySeveralService({
        planner: payPlan,
        invoices: input.payments.invoiceInitiation,
        limits: input.payments.tierLimits,
        compliance: input.payments.compliance,
        checkout: input.payments.groupCheckout,
      }),
      deliveryQuotes: new DeliveryQuoteService({ quotes, purchases }),
      problems: new PurchaseProblemService({
        purchases,
        problems: new DrizzlePurchaseProblemRepository(input.db),
        transactionRunner: input.transactionRunner,
        events: input.events,
        now: () => new Date(),
      }),
      collection: new CollectionBookingService({
        settings: {
          selfServeEnabled: input.env.COLLECTION_SELF_SERVE_ENABLED,
          slotCapacityPerHour: input.env.COLLECTION_SLOT_CAPACITY_PER_HOUR ?? null,
          hours: input.env.COLLECTION_HOURS ?? null,
          bookingEmail: input.env.COLLECTION_BOOKING_EMAIL ?? SITE_CONTACT_EMAIL,
        },
        purchases,
        places: lookups,
      }),
    },
    staffDeliveryQuotes: new StaffDeliveryQuoteService({
      quotes,
      lots: lookups,
      notifier: new DeliveryQuoteReadyNotifier(
        input.lots,
        input.notificationDispatcher,
        input.notificationFactory,
      ),
    }),
  };
}
