import type { Database } from "@auction/db";
import type { Env } from "../env.js";
import { CompositeErrorClassifier } from "../infrastructure/composite-error.classifier.js";
import { ConsoleErrorLogger } from "../infrastructure/console-error.logger.js";
import { JsonErrorResponseBuilder } from "../infrastructure/json-error-response.builder.js";
import { createBaseLogger } from "../lib/logger.js";
import { queueRuntimeEnvFromApiEnv } from "../lib/queue-runtime-env.js";
import { DrizzleAuthCredentialReader } from "../repositories/drizzle-auth-credential.reader.js";
import type { IAuthCredentialReader } from "../repositories/interfaces/auth-credential.reader.js";
import { AdminMarketingEventsService } from "../services/admin/admin-marketing-events.service.js";
import { AdminPaymentListQueryService } from "../services/admin/admin-payment-list-query.service.js";
import { StructuredQueueAuditService } from "../services/admin/queue-audit.service.js";
import { BullMQQueueInspector } from "../services/admin/queue-inspector.service.js";
import { BullMQQueueMutator } from "../services/admin/queue-mutator.service.js";
import { AnalyticsService } from "../services/analytics.service.js";
import { DefaultMetricsAggregator } from "../services/default-metrics.aggregator.js";
import { EmailUnsubscribeService } from "../services/email-unsubscribe.service.js";
import { ErrorHandlerService } from "../services/error-handler.service.js";
import { NewsletterSignupService } from "../services/newsletter-signup.service.js";
import { PostmarkWebhookService } from "../services/postmark-webhook.service.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPaymentsServices } from "./create-payments-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerUserUtilityServices = {
  analyticsService: AnalyticsService;
  httpErrorHandler: ErrorHandlerService;
  queueAdmin: {
    inspector: BullMQQueueInspector;
    mutator: BullMQQueueMutator;
    close: () => Promise<void>;
  };
  closeBullQueues: () => Promise<void>;
  adminMarketingEventsService: AdminMarketingEventsService;
  emailUnsubscribeService: EmailUnsubscribeService;
  postmarkWebhookService: PostmarkWebhookService;
  adminPaymentListQueryService: AdminPaymentListQueryService;
  authCredentialReader: IAuthCredentialReader;
  newsletterSignupService: NewsletterSignupService;
};

export type CreateUserUtilityServicesInput = {
  env: Env;
  db: Database;
  authDb: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  payments: ContainerPaymentsServices;
};

export function createUserUtilityServices(
  input: CreateUserUtilityServicesInput,
): ContainerUserUtilityServices {
  const { env, db, authDb, infra, repos, payments } = input;
  const {
    redis,
    bullConnection,
    emailQueue,
    legalEntityArchiveQueue,
    uploadValidationQueue,
    imageCleanupQueue,
    qrCodeScanQueue,
    marketingSyncQueue,
    marketingEventsBullQueue,
    payoutStatementQueue,
    dataExportQueue,
  } = infra;
  const {
    lotMetrics,
    paymentMetrics,
    userMetrics,
    paymentRepo,
    adminMarketingEventOutboxRepository,
    emailSuppressionRepository,
    emailWebhookIngestRepository,
    newsletterSignupRepository,
    notificationPreferenceRepository,
    userRepo,
  } = repos;
  const { errorReporter } = payments;

  const metricsAggregator = new DefaultMetricsAggregator();
  const analyticsService = new AnalyticsService(
    lotMetrics,
    paymentMetrics,
    userMetrics,
    metricsAggregator,
  );

  const httpErrorHandler = new ErrorHandlerService(
    new CompositeErrorClassifier(),
    new ConsoleErrorLogger(env),
    errorReporter,
    new JsonErrorResponseBuilder(),
  );

  const queueAudit = new StructuredQueueAuditService(createBaseLogger(env));
  const queueInspector = new BullMQQueueInspector(
    bullConnection,
    redis,
    queueRuntimeEnvFromApiEnv(env),
  );
  const queueMutator = new BullMQQueueMutator(bullConnection, redis, db, queueAudit, env.APP_ENV);
  const queueAdmin = {
    inspector: queueInspector,
    mutator: queueMutator,
    close: async () => {
      await Promise.allSettled([queueInspector.close(), queueMutator.close()]);
    },
  };

  const closeBullQueues = async () => {
    await Promise.allSettled([
      emailQueue.close(),
      legalEntityArchiveQueue.close(),
      uploadValidationQueue.close(),
      imageCleanupQueue.close(),
      qrCodeScanQueue.close(),
      marketingSyncQueue.close(),
      marketingEventsBullQueue.close(),
      payoutStatementQueue.close(),
      dataExportQueue.close(),
      queueAdmin.close(),
    ]);
  };

  const adminMarketingEventsService = new AdminMarketingEventsService(
    adminMarketingEventOutboxRepository,
    env.SENTRY_DSN_API,
  );

  const emailUnsubscribeService = new EmailUnsubscribeService(
    emailSuppressionRepository,
    env,
    userRepo,
    notificationPreferenceRepository,
  );
  const postmarkWebhookService = new PostmarkWebhookService(
    emailWebhookIngestRepository,
    emailSuppressionRepository,
    (token) => emailUnsubscribeService.applyToken(token),
  );
  const authCredentialReader = new DrizzleAuthCredentialReader(authDb);
  const newsletterSignupService = new NewsletterSignupService(
    newsletterSignupRepository,
    marketingSyncQueue,
  );

  const adminPaymentListQueryService = new AdminPaymentListQueryService(paymentRepo);

  return {
    analyticsService,
    httpErrorHandler,
    queueAdmin,
    closeBullQueues,
    adminMarketingEventsService,
    emailUnsubscribeService,
    postmarkWebhookService,
    adminPaymentListQueryService,
    authCredentialReader,
    newsletterSignupService,
  };
}
