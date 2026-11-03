import { SITE_CONTACT_EMAIL } from "@auction/branding";
import type { Database } from "@auction/db";
import type { PaymentTierLimits } from "@auction/domain";
import type {
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
import type { ISettlementCompliancePolicy } from "../services/aml/settlement-compliance.policy.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { INotificationFactory } from "../services/interfaces/notification-factory.js";
import type {
  IAccountPurchasesService,
  IAccountRegistrationsService,
  ICollectionBookingService,
  IDeliveryQuoteService,
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
import { PaySeveralService } from "../services/organisation-buying/pay-several.service.js";
import { PurchaseProblemService } from "../services/organisation-buying/purchase-problem.service.js";
import { WonLotLookups } from "../services/organisation-buying/won-lot-lookups.js";
import type { PaymentGroupCheckoutService } from "../services/payment-group/payment-group-checkout.service.js";

/** The client workspace's buying modules for the acting account. */
export type OrganisationBuyingServices = {
  registrations: IAccountRegistrationsService;
  purchases: IAccountPurchasesService;
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
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  notificationDispatcher: Pick<NotificationDispatcher, "dispatch">;
  notificationFactory: Pick<INotificationFactory, "createDeliveryQuoteReady">;
  /** What paying several invoices at once needs from the payments side. */
  payments: {
    tierLimits: PaymentTierLimits;
    compliance: Pick<ISettlementCompliancePolicy, "peek" | "evaluate"> | null;
    groupCheckout: Pick<PaymentGroupCheckoutService, "start">;
  };
};

export function createOrganisationBuyingServices(input: CreateOrganisationBuyingInput): {
  client: OrganisationBuyingServices;
  staffDeliveryQuotes: IStaffDeliveryQuoteService;
} {
  const purchases = new DrizzleAccountPurchaseFactsReader(input.db);
  const quotes = new DrizzleDeliveryQuoteRepository(input.db);
  const lookups = new WonLotLookups(input.lots, input.sales);
  return {
    client: {
      registrations: new AccountRegistrationsService(
        new DrizzleAccountRegistrationsReader(input.db),
      ),
      purchases: new AccountPurchasesService({ reader: purchases, now: () => new Date() }),
      paySeveral: new PaySeveralService({
        reader: purchases,
        flags: new DrizzlePaySeveralInvoiceFlagsReader(input.db),
        limits: input.payments.tierLimits,
        compliance: input.payments.compliance,
        checkout: input.payments.groupCheckout,
        now: () => new Date(),
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
