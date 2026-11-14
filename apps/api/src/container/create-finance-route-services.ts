import type { AccountingReplayCronService } from "@auction/finance-cron-app";
import type { PaymentMaintenanceCronService } from "@auction/finance-cron-app";
import type { IAttributionStore } from "@auction/marketing-events";
import type {
  ILegalEntityRepository,
  IPayoutRepository,
  IWebhookEventRepository,
  IXeroWebhookEventRepository,
} from "@auction/persistence/interfaces";
import type { WebhookEventsQueueProducer } from "@auction/queues";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Env } from "../env.js";
import type { StripeWebhookVerifier } from "../lib/stripe-webhook-verifier.js";
import type { SettlementCronService } from "../services/cron/settlement-cron.service.js";
import { BuyerPaymentHttpApplicationService } from "../services/finance/buyer-payment-http-application.service.js";
import { EntityStaffPaymentApplicationService } from "../services/finance/entity-staff-payment-application.service.js";
import { FinanceAccountingCronApplicationService } from "../services/finance/finance-accounting-cron-application.service.js";
import { FinanceSettlementCronApplicationService } from "../services/finance/finance-settlement-cron-application.service.js";
import { InternalCronApplicationService } from "../services/finance/internal-cron-application.service.js";
import { PayoutStatementApplicationService } from "../services/finance/payout-statement-application.service.js";
import { SellerPayoutHttpApplicationService } from "../services/finance/seller-payout-http-application.service.js";
import { StripeConnectHttpApplicationService } from "../services/finance/stripe-connect-http-application.service.js";
import { StripeWebhookIngressApplicationService } from "../services/finance/stripe-webhook-ingress-application.service.js";
import { XeroWebhookIngressApplicationService } from "../services/finance/xero-webhook-ingress-application.service.js";
import {
  type ZohoBooksNoticeAlerts,
  ZohoBooksNoticeIngressApplicationService,
} from "../services/finance/zoho-books-notice-ingress-application.service.js";
import type { IBuyerComplianceHttpApplicationService } from "../services/interfaces/compliance-routes/compliance-buyer-http.js";
import type { FinanceRouteServices } from "../services/interfaces/finance-routes/index.js";
import type { IInvoiceAccountingProvider } from "../services/interfaces/invoice-accounting.js";
import type { ILotFulfilmentBuyerService } from "../services/interfaces/lot-fulfilment-service.js";
import type { IMarketingEventService } from "../services/interfaces/marketing-event-service.js";
import type {
  IPaymentAdminService,
  IPaymentBuyerService,
} from "../services/interfaces/payment-service.js";
import type { IPayoutSellerService } from "../services/interfaces/payout.js";
import type { IPrivateSaleDealParties } from "../services/interfaces/private-sale-deal-desk.js";
import type { IStripeConnectService } from "../services/interfaces/stripe-connect.js";
import type { IDealPayoutSettler } from "../services/private-sale-deal/deal-payout-settlement.service.js";
import type { SourceOfFundsDocumentCollectionService } from "../services/source-of-funds/source-of-funds-document-collection.service.js";
import type { StripePaymentWebhookService } from "../services/stripe-payment-webhook.service.js";

export type CreateFinanceRouteServicesInput = {
  /** Settles private sale deals whose payout was paid, after each bulk payout run. */
  dealPayoutSettler: IDealPayoutSettler;
  privateSaleDealParties: IPrivateSaleDealParties;
  redis: Redis;
  legalEntityRepository: ILegalEntityRepository;
  payoutRepository: IPayoutRepository;
  payoutStatementQueue: Queue<{ payoutId: string }>;
  paymentAdminService: IPaymentAdminService;
  paymentBuyerService: IPaymentBuyerService;
  buyerComplianceHttp: IBuyerComplianceHttpApplicationService;
  lotFulfilmentBuyerService: ILotFulfilmentBuyerService;
  marketingEventService: IMarketingEventService;
  attributionStore: IAttributionStore;
  marketingAttributionEnabled: boolean;
  sourceOfFundsDocumentCollectionService: SourceOfFundsDocumentCollectionService;
  settlementCronService: SettlementCronService;
  paymentMaintenanceCronService: PaymentMaintenanceCronService;
  accountingReplayCronService: AccountingReplayCronService;
  stripeWebhookVerifier: StripeWebhookVerifier;
  stripeConnectService: IStripeConnectService;
  stripePaymentWebhookService: StripePaymentWebhookService | null;
  payoutSellerService: IPayoutSellerService;
  env: Pick<
    Env,
    | "XERO_WEBHOOK_KEY"
    | "XERO_WEBHOOK_INBOX_MODE"
    | "XERO_API_WRITES_DISABLED"
    | "ZOHO_BOOKS_NOTICE_SECRET"
  >;
  /** Where a refused Books notice signature is raised (logged and sent to Sentry). */
  zohoBooksNoticeAlerts: ZohoBooksNoticeAlerts;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
  accountingProvider: IInvoiceAccountingProvider;
  webhookEventRepository?: IWebhookEventRepository;
  webhookEventsProducer?: WebhookEventsQueueProducer | null;
};

export function createFinanceRouteServices(
  input: CreateFinanceRouteServicesInput,
): FinanceRouteServices {
  return {
    privateSaleDealParties: input.privateSaleDealParties,
    payoutStatement: new PayoutStatementApplicationService(
      input.legalEntityRepository,
      input.payoutRepository,
      input.payoutStatementQueue,
    ),
    sellerPayoutHttp: new SellerPayoutHttpApplicationService(input.payoutSellerService),
    stripeConnectHttp: new StripeConnectHttpApplicationService(input.stripeConnectService),
    buyerPaymentHttp: new BuyerPaymentHttpApplicationService(
      input.redis,
      input.sourceOfFundsDocumentCollectionService,
      input.paymentBuyerService,
      input.buyerComplianceHttp,
      input.lotFulfilmentBuyerService,
      input.marketingEventService,
      input.attributionStore,
      input.marketingAttributionEnabled,
    ),
    entityStaffPayment: new EntityStaffPaymentApplicationService(input.paymentAdminService),
    internalCron: new InternalCronApplicationService(
      input.redis,
      input.settlementCronService,
      input.paymentMaintenanceCronService,
      input.dealPayoutSettler,
    ),
    accountingCron: new FinanceAccountingCronApplicationService(
      input.accountingReplayCronService,
      input.env,
    ),
    settlementCron: new FinanceSettlementCronApplicationService(input.settlementCronService),
    stripeWebhooks: new StripeWebhookIngressApplicationService(
      input.stripeWebhookVerifier,
      input.stripeConnectService,
      input.stripePaymentWebhookService,
    ),
    xeroWebhooks: new XeroWebhookIngressApplicationService(
      input.env,
      input.xeroWebhookEventRepository,
      input.accountingProvider,
      input.webhookEventRepository ?? null,
      input.env.XERO_WEBHOOK_INBOX_MODE === "inbox" ? (input.webhookEventsProducer ?? null) : null,
    ),
    zohoBooksNotices: new ZohoBooksNoticeIngressApplicationService(
      input.env.ZOHO_BOOKS_NOTICE_SECRET,
      input.webhookEventRepository ?? null,
      input.webhookEventsProducer ?? null,
      input.zohoBooksNoticeAlerts,
    ),
  };
}
