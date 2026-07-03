import type { Database } from "@auction/db";
import type { Env } from "../env.js";
import { NoOpErrorReporter } from "../infrastructure/no-op-error.reporter.js";
import { SentryErrorReporter } from "../infrastructure/sentry-error.reporter.js";
import { DrizzlePaymentDomainEventsRepository } from "../repositories/drizzle-payment-domain-events.repository.js";
import { NoOpAccountingProvider } from "../services/accounting/no-op-accounting.provider.js";
import { XeroAccountingProvider } from "../services/accounting/xero-accounting.provider.js";
import { XeroPaymentRecorder } from "../services/accounting/xero-payment-recorder.js";
import { XeroPayoutBillWriter } from "../services/accounting/xero-payout-bill.writer.js";
import { AdminMetricsService } from "../services/admin-metrics.service.js";
import { AmlSettlementCompliancePolicy } from "../services/aml/settlement-compliance.policy.js";
import type { IErrorReporter } from "../services/interfaces/error-handling.js";
import type { IInvoiceAccountingProvider } from "../services/interfaces/invoice-accounting.js";
import type { IPaymentService } from "../services/interfaces/payment-service.js";
import { LotFulfilmentService } from "../services/lot-fulfilment.service.js";
import { LotInvoiceInitiationService } from "../services/lot-invoice-initiation.service.js";
import { PaymentService } from "../services/payment.service.js";
import { BankTransferCheckoutRail } from "../services/payment/bank-transfer-checkout.rail.js";
import { CardCheckoutRail } from "../services/payment/card-checkout.rail.js";
import { PaymentCaptureService } from "../services/payment/payment-capture.service.js";
import {
  PaymentTierPolicy,
  parsePaymentTierLimits,
} from "../services/payment/payment-tier.policy.js";
import { PlatformFeePolicy } from "../services/payment/platform-fee.policy.js";
import { StripeCheckoutService } from "../services/payment/stripe-checkout.service.js";
import { StripePaymentWebhookService } from "../services/stripe-payment-webhook.service.js";
import { StripeCustomerGateway } from "../services/stripe/stripe-customer.gateway.js";
import { StripePaymentGateway } from "../services/stripe/stripe-payment-gateway.js";
import { XeroOAuthService } from "../services/xero-oauth.service.js";
import type { ContainerCatalogServices } from "./create-catalog-services.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerPaymentsServices = {
  errorReporter: IErrorReporter;
  accountingProvider: IInvoiceAccountingProvider;
  xeroPayoutBillWriter: XeroPayoutBillWriter | null;
  stripePaymentGateway: StripePaymentGateway;
  xeroPaymentRecorder: XeroPaymentRecorder | null;
  lotFulfilmentService: LotFulfilmentService;
  paymentCaptureService: PaymentCaptureService;
  stripeCheckoutService: StripeCheckoutService | null;
  paymentService: IPaymentService;
  lotInvoiceInitiationService: LotInvoiceInitiationService;
  stripePaymentWebhookService: StripePaymentWebhookService | null;
  xeroOAuthService: XeroOAuthService | null;
  adminMetricsService: AdminMetricsService;
};

export type CreatePaymentsServicesInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  complianceMedia: ContainerComplianceMedia;
  catalog: ContainerCatalogServices;
};

export function createPaymentsServices(
  input: CreatePaymentsServicesInput,
): ContainerPaymentsServices {
  const { env, db, infra, repos, platform, complianceMedia, catalog } = input;
  const { redis, stripeClientFactory } = infra;
  const {
    legalEntityRepository,
    xeroConnRepo,
    paymentExtRepo,
    payoutRepository,
    paymentRepo,
    lotRepo,
    userRepo,
    legalEntityNotificationRecipients,
    saleRepo,
    addressRepo,
    amlHoldStore,
    repoFactory,
  } = repos;
  const {
    invoiceAddressingService,
    domainEventPublisher,
    notificationDispatcher,
    notificationFactory,
    payoutAdjustmentService,
    paymentRefundReconcileService,
    notificationOutboxService,
  } = platform;
  const { marketingEventService, mediaUrlResolver, sourceOfFundsService } = complianceMedia;
  const { itemSubmissionAdminApi } = catalog;

  const errorReporter: IErrorReporter = env.SENTRY_DSN_API
    ? new SentryErrorReporter()
    : new NoOpErrorReporter();

  const xeroEnvEnabled = Boolean(
    env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET && env.XERO_REDIRECT_URI,
  );

  const platformFeePolicy = new PlatformFeePolicy(legalEntityRepository);

  const paymentTierPolicy = new PaymentTierPolicy(parsePaymentTierLimits(env));

  const accountingProvider: IInvoiceAccountingProvider = xeroEnvEnabled
    ? new XeroAccountingProvider(
        {
          XERO_CLIENT_ID: env.XERO_CLIENT_ID,
          XERO_CLIENT_SECRET: env.XERO_CLIENT_SECRET,
          XERO_REDIRECT_URI: env.XERO_REDIRECT_URI,
          XERO_DEFAULT_REVENUE_ACCOUNT_CODE: env.XERO_DEFAULT_REVENUE_ACCOUNT_CODE,
          XERO_DEFAULT_TAX_TYPE: env.XERO_DEFAULT_TAX_TYPE,
          XERO_INVOICE_DUE_DAYS: env.XERO_INVOICE_DUE_DAYS,
          XERO_USE_LEGAL_ENTITY_CONTACT: env.XERO_USE_LEGAL_ENTITY_CONTACT,
        },
        xeroConnRepo,
        paymentExtRepo,
        legalEntityRepository,
        invoiceAddressingService,
        errorReporter,
        redis,
      )
    : new NoOpAccountingProvider();

  const xeroPayoutBillWriter: XeroPayoutBillWriter | null = xeroEnvEnabled
    ? new XeroPayoutBillWriter(
        {
          XERO_CLIENT_ID: env.XERO_CLIENT_ID,
          XERO_CLIENT_SECRET: env.XERO_CLIENT_SECRET,
          XERO_REDIRECT_URI: env.XERO_REDIRECT_URI,
          XERO_DEFAULT_TAX_TYPE: env.XERO_DEFAULT_TAX_TYPE,
          XERO_PAYOUT_BILL_ACCOUNT_CODE: env.XERO_PAYOUT_BILL_ACCOUNT_CODE,
        },
        xeroConnRepo,
        payoutRepository,
        legalEntityRepository,
        errorReporter,
        redis,
      )
    : null;

  const stripePaymentGateway = new StripePaymentGateway(env, stripeClientFactory);

  const xeroPaymentRecorder = xeroEnvEnabled
    ? new XeroPaymentRecorder(
        {
          XERO_CLIENT_ID: env.XERO_CLIENT_ID,
          XERO_CLIENT_SECRET: env.XERO_CLIENT_SECRET,
          XERO_REDIRECT_URI: env.XERO_REDIRECT_URI,
          XERO_PAYMENT_BANK_ACCOUNT_CODE: env.XERO_PAYMENT_BANK_ACCOUNT_CODE,
        },
        xeroConnRepo,
        paymentExtRepo,
        errorReporter,
        redis,
      )
    : null;

  const lotFulfilmentService = new LotFulfilmentService(db, lotRepo);

  const paymentCaptureService = new PaymentCaptureService(
    db,
    paymentRepo,
    lotRepo,
    userRepo,
    domainEventPublisher,
    notificationDispatcher,
    notificationFactory,
    legalEntityNotificationRecipients,
    {
      ensureAwaitingPayment: (lotId, paymentId, addressSnapshot) =>
        lotFulfilmentService.ensureAwaitingPayment(lotId, paymentId, addressSnapshot),
      onPaymentCaptured: (lotId, paymentId) =>
        lotFulfilmentService.onPaymentCaptured(lotId, paymentId),
    },
    marketingEventService,
    xeroPaymentRecorder,
    stripePaymentGateway,
  );
  const stripeCustomerGateway = new StripeCustomerGateway(
    env,
    legalEntityRepository,
    stripeClientFactory,
  );

  const stripeCheckoutService = stripePaymentGateway.isConfigured()
    ? new StripeCheckoutService([
        new CardCheckoutRail(env, stripePaymentGateway, paymentRepo, mediaUrlResolver),
        new BankTransferCheckoutRail(
          env,
          stripePaymentGateway,
          stripeCustomerGateway,
          paymentRepo,
          mediaUrlResolver,
        ),
      ])
    : null;

  const settlementCompliancePolicy = new AmlSettlementCompliancePolicy(
    amlHoldStore,
    sourceOfFundsService,
  );
  const paymentDomainEventsRepository = new DrizzlePaymentDomainEventsRepository(
    db,
    domainEventPublisher,
  );
  const paymentService = new PaymentService(
    lotRepo,
    paymentRepo,
    notificationDispatcher,
    notificationFactory,
    userRepo,
    accountingProvider,
    paymentTierPolicy,
    legalEntityRepository,
    db,
    domainEventPublisher,
    stripePaymentGateway,
    mediaUrlResolver,
    {
      ensureAwaitingPayment: (lotId, paymentId, addressSnapshot) =>
        lotFulfilmentService.ensureAwaitingPayment(lotId, paymentId, addressSnapshot),
      onPaymentCaptured: (lotId, paymentId) =>
        lotFulfilmentService.onPaymentCaptured(lotId, paymentId),
    },
    saleRepo,
    marketingEventService,
    platformFeePolicy,
    paymentCaptureService,
    stripeCheckoutService,
    payoutAdjustmentService,
    paymentRefundReconcileService,
    xeroPaymentRecorder,
    addressRepo,
    settlementCompliancePolicy,
    env.XERO_INVOICE_BLOCKING,
    paymentDomainEventsRepository,
  );

  const lotInvoiceInitiationService = new LotInvoiceInitiationService(
    lotRepo,
    saleRepo,
    paymentRepo,
    settlementCompliancePolicy,
    paymentTierPolicy,
    platformFeePolicy,
    accountingProvider,
    notificationOutboxService,
    notificationFactory,
    domainEventPublisher,
    {
      ensureAwaitingPayment: (lotId, paymentId, addressSnapshot) =>
        lotFulfilmentService.ensureAwaitingPayment(lotId, paymentId, addressSnapshot),
      onPaymentCaptured: (lotId, paymentId) =>
        lotFulfilmentService.onPaymentCaptured(lotId, paymentId),
    },
    legalEntityRepository,
    userRepo,
    db,
  );

  const stripePaymentWebhookService: StripePaymentWebhookService | null =
    env.STRIPE_SECRET_KEY && env.STRIPE_PAYMENTS_WEBHOOK_SECRET
      ? new StripePaymentWebhookService(
          db,
          paymentRepo,
          payoutRepository,
          payoutAdjustmentService,
          paymentCaptureService,
          domainEventPublisher,
        )
      : null;

  const xeroOAuthService = xeroEnvEnabled ? new XeroOAuthService(redis, env, xeroConnRepo) : null;

  const adminMetricsService = new AdminMetricsService(
    repoFactory,
    redis,
    itemSubmissionAdminApi,
    paymentService,
  );

  return {
    errorReporter,
    accountingProvider,
    xeroPayoutBillWriter,
    stripePaymentGateway,
    xeroPaymentRecorder,
    lotFulfilmentService,
    paymentCaptureService,
    stripeCheckoutService,
    paymentService,
    lotInvoiceInitiationService,
    stripePaymentWebhookService,
    xeroOAuthService,
    adminMetricsService,
  };
}
