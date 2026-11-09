import type { Database } from "@auction/db";
import {
  DrizzleBuyerDefaultReader,
  DrizzleBuyerDefaultRepository,
  DrizzlePaymentReminderStore,
  DrizzlePrivateSaleDealReminderStore,
  createDrizzleLotTransitionRepository,
} from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import { BuyerDefaultService } from "../services/buyer-default/buyer-default.service.js";
import { PaymentReminderService } from "../services/buyer-default/payment-reminder.service.js";
import { revokeOpenStripeCheckoutForPayment } from "../services/payment/checkout-orchestrator.js";
import { DealReminderService } from "../services/private-sale-deal/deal-reminder.service.js";
import { DrizzleAdminUserSuspender } from "./adapters/drizzle-admin-user-suspender.js";
import type { ContainerCatalogServices } from "./create-catalog-services.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPaymentsServices } from "./create-payments-services.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerBuyerDefaultServices = {
  buyerDefaultService: BuyerDefaultService;
  paymentReminderService: PaymentReminderService;
  /** The lot and deal reminders the internal cron sends. */
  paymentReminders: Pick<PaymentReminderService, "sendDueReminders">;
};

/**
 * An unpaid won lot: the reminders the buyer gets, and the staff action that cancels the sale
 * when they never pay. Both sit on the same notification and payment ports as the rest of the
 * payment flow.
 */
export function createBuyerDefaultServices(input: {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  catalog: ContainerCatalogServices;
  payments: ContainerPaymentsServices;
}): ContainerBuyerDefaultServices {
  const { env, db, infra, repos, platform, catalog, payments } = input;

  const buyerDefaultService = new BuyerDefaultService({
    reader: new DrizzleBuyerDefaultReader(db),
    repository: new DrizzleBuyerDefaultRepository(db),
    transactionRunner: platform.transactionRunner,
    transitions: createDrizzleLotTransitionRepository(db),
    recorder: platform.lotLifecycleRecording,
    suspender: new DrizzleAdminUserSuspender(db, {
      emailService: infra.emailService,
      accountSuspendedSupportEmail: env.EMAIL_REPLY_TO?.trim() || "support@lax.bid",
    }),
    dispatcher: platform.notificationDispatcher,
    factory: platform.notificationFactory,
    recipients: repos.legalEntityNotificationRecipients,
    closeCheckout: (paymentId) =>
      revokeOpenStripeCheckoutForPayment(
        { payments: repos.paymentRepo, stripePayments: payments.stripePaymentGateway },
        paymentId,
      ),
    events: platform.domainEventSink,
    jobScheduler: catalog.lotJobScheduler,
  });

  const paymentReminderService = new PaymentReminderService({
    store: new DrizzlePaymentReminderStore(db),
    compliance: payments.settlementCompliancePolicy,
    outbox: platform.notificationOutboxService,
    factory: platform.notificationFactory,
    recipients: payments.invoiceRecipients,
    eligibility: payments.paymentEligibility,
  });

  const dealReminderService = new DealReminderService({
    store: new DrizzlePrivateSaleDealReminderStore(db),
    compliance: payments.settlementCompliancePolicy,
    outbox: platform.notificationOutboxService,
    factory: platform.notificationFactory,
    recipients: payments.invoiceRecipients,
    eligibility: payments.paymentEligibility,
  });

  return {
    buyerDefaultService,
    paymentReminderService,
    // One hourly job reminds buyers of unpaid lot invoices and of a deal's deadlines.
    paymentReminders: {
      async sendDueReminders() {
        const lots = await paymentReminderService.sendDueReminders();
        const deals = await dealReminderService.sendDueReminders();
        return { reminded: lots.reminded + deals.reminded };
      },
    },
  };
}
