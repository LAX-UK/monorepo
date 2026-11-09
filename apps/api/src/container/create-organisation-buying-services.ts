import { SITE_CONTACT_EMAIL, legalEntityFor } from "@auction/branding";
import type { Database } from "@auction/db";
import type { PaymentTierLimits } from "@auction/domain";
import { renderBidInvoicePdf } from "@auction/exports/documents";
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
  DrizzleChargeableDeliveryReader,
  DrizzleCollectionBookingRepository,
  DrizzleCollectionLotFactsReader,
  DrizzleCollectionPlaceRepository,
  DrizzleDeliveryQuoteRepository,
  DrizzlePaySeveralInvoiceFlagsReader,
  DrizzlePaymentGroupFactsReader,
  DrizzlePurchaseProblemRepository,
} from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import type { AppLogger } from "../lib/logger.js";
import { recordMoneyPathEvent } from "../middleware/metrics.js";
import type {
  ISettlementComplianceAssessor,
  ISettlementCompliancePolicy,
} from "../services/aml/settlement-compliance.policy.js";
import { CollectionLotGuard } from "../services/collection-visits/collection-lot-guard.js";
import { CollectionVisitService } from "../services/collection-visits/collection-visit.service.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { ICollectionVisitService } from "../services/interfaces/collection-visit-service.js";
import type { INotificationFactory } from "../services/interfaces/notification-factory.js";
import type {
  IAccountPurchasesService,
  IAccountRegistrationsService,
  ICollectionBookingService,
  IDeliveryQuoteService,
  IPayPlanService,
  IPayProgressReadService,
  IPaySeveralService,
  IPayTransferService,
  IPurchaseInvoicePdfService,
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
import { PayProgressReadService } from "../services/organisation-buying/pay-progress-read.service.js";
import { PayProgressResolver } from "../services/organisation-buying/pay-progress.resolver.js";
import { PaySeveralService } from "../services/organisation-buying/pay-several.service.js";
import { PayTransferService } from "../services/organisation-buying/pay-transfer.service.js";
import { PurchaseCandidateReader } from "../services/organisation-buying/purchase-candidate.reader.js";
import {
  type IBuyerRefundsReader,
  PurchaseInvoicePdfService,
} from "../services/organisation-buying/purchase-invoice-pdf.service.js";
import { PurchaseProblemService } from "../services/organisation-buying/purchase-problem.service.js";
import { WonLotLookups } from "../services/organisation-buying/won-lot-lookups.js";
import type { PaymentGroupCheckoutService } from "../services/payment-group/payment-group-checkout.service.js";
import type { IPaymentGroupGateway } from "../services/payment-group/payment-group-ports.js";
import { StillToSendService } from "../services/payment-group/still-to-send.service.js";
import type { IPaymentEligibilityGate } from "../services/payment/payment-eligibility.gate.js";

/** The client workspace's buying modules for the acting account. */
export type OrganisationBuyingServices = {
  registrations: IAccountRegistrationsService;
  purchases: IAccountPurchasesService;
  payPlan: IPayPlanService;
  paySeveral: IPaySeveralService;
  payTransfer: IPayTransferService;
  invoicePdf: IPurchaseInvoicePdfService;
  payProgress: IPayProgressReadService;
  deliveryQuotes: IDeliveryQuoteService;
  collection: ICollectionBookingService;
  collectionVisits: ICollectionVisitService;
  problems: IPurchaseProblemService;
};

export type CreateOrganisationBuyingInput = {
  db: Database;
  /** Where money-path alerts leave their ids and amounts. */
  log: Pick<AppLogger, "warn">;
  env: Pick<
    Env,
    | "COLLECTION_SELF_SERVE_ENABLED"
    | "DELIVERY_IN_PAYMENT_ENABLED"
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
    /** Asks the payment provider how a combined checkout stands, and for transfer details. */
    groupGateway: Pick<IPaymentGroupGateway, "checkoutStatus" | "bankTransferInstructions">;
    invoices: IBidInvoiceReader;
    /** What the buyer has been refunded for a payment, for the invoice document. */
    refunds: IBuyerRefundsReader;
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
  const lotFacts = new DrizzleCollectionLotFactsReader(input.db);
  const collectionPlaces = new DrizzleCollectionPlaceRepository(input.db);
  const bid = legalEntityFor("bid");
  const progress = new PayProgressResolver(input.payments.groupGateway);
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
    progress,
    delivery: input.env.DELIVERY_IN_PAYMENT_ENABLED
      ? new DrizzleChargeableDeliveryReader(input.db)
      : null,
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
      purchases: new AccountPurchasesService({
        reader: purchases,
        stillToSend: new StillToSendService(new DrizzlePaymentGroupFactsReader(input.db)),
        now: () => new Date(),
      }),
      payPlan,
      paySeveral: new PaySeveralService({
        planner: payPlan,
        invoices: input.payments.invoiceInitiation,
        limits: input.payments.tierLimits,
        compliance: input.payments.compliance,
        checkout: input.payments.groupCheckout,
        metrics: { record: recordMoneyPathEvent },
      }),
      payProgress: new PayProgressReadService({ candidates, progress }),
      invoicePdf: new PurchaseInvoicePdfService({
        candidates,
        invoices: input.payments.invoices,
        accounts: input.accounts,
        render: renderBidInvoicePdf,
        refunds: input.payments.refunds,
        metrics: { record: recordMoneyPathEvent },
        log: input.log,
      }),
      payTransfer: new PayTransferService({
        candidates,
        progress,
        gateway: input.payments.groupGateway,
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
        collectionPlaces,
        purchases,
        places: lookups,
      }),
      collectionVisits: new CollectionVisitService({
        lots: new CollectionLotGuard(lotFacts),
        facts: lotFacts,
        places: collectionPlaces,
        bookings: new DrizzleCollectionBookingRepository(input.db),
        events: input.events,
        now: () => new Date(),
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
