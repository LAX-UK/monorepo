import type { AccountingReplayCronService } from "@auction/finance-cron-app";
import type { PaymentMaintenanceCronService } from "@auction/finance-cron-app";
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
import type { IStripeConnectService } from "../services/interfaces/stripe-connect.js";
import type { SourceOfFundsDocumentCollectionService } from "../services/source-of-funds/source-of-funds-document-collection.service.js";
import type { StripePaymentWebhookService } from "../services/stripe-payment-webhook.service.js";

export type CreateFinanceRouteServicesInput = {
  redis: Redis;
  legalEntityRepository: ILegalEntityRepository;
  payoutRepository: IPayoutRepository;
  payoutStatementQueue: Queue<{ payoutId: string }>;
  paymentAdminService: IPaymentAdminService;
  paymentBuyerService: IPaymentBuyerService;
  buyerComplianceHttp: IBuyerComplianceHttpApplicationService;
  lotFulfilmentBuyerService: ILotFulfilmentBuyerService;
  marketingEventService: IMarketingEventService;
  sourceOfFundsDocumentCollectionService: SourceOfFundsDocumentCollectionService;
  settlementCronService: SettlementCronService;
  paymentMaintenanceCronService: PaymentMaintenanceCronService;
  accountingReplayCronService: AccountingReplayCronService;
  stripeWebhookVerifier: StripeWebhookVerifier;
  stripeConnectService: IStripeConnectService;
  stripePaymentWebhookService: StripePaymentWebhookService | null;
  payoutSellerService: IPayoutSellerService;
  env: Pick<Env, "XERO_WEBHOOK_KEY" | "XERO_WEBHOOK_INBOX_MODE" | "XERO_API_WRITES_DISABLED">;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
  accountingProvider: IInvoiceAccountingProvider;
  webhookEventRepository?: IWebhookEventRepository;
  webhookEventsProducer?: WebhookEventsQueueProducer | null;
};

export function createFinanceRouteServices(
  input: CreateFinanceRouteServicesInput,
): FinanceRouteServices {
  return {
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
    ),
    entityStaffPayment: new EntityStaffPaymentApplicationService(input.paymentAdminService),
    internalCron: new InternalCronApplicationService(
      input.redis,
      input.settlementCronService,
      input.paymentMaintenanceCronService,
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
  };
}
