import type { Database } from "@auction/db";
import type { Env } from "../env.js";
import { AccountDeletionEligibilityService } from "../services/account-deletion-eligibility.service.js";
import { BrevoWebhookIngestService } from "../services/brevo-webhook-ingest.service.js";
import { AccountingReplayCronService } from "../services/cron/accounting-replay-cron.service.js";
import { HygieneCronService } from "../services/cron/hygiene-cron.service.js";
import { LifecycleCronService } from "../services/cron/lifecycle-cron.service.js";
import { PaymentMaintenanceCronService } from "../services/cron/payment-maintenance-cron.service.js";
import { SettlementCronService } from "../services/cron/settlement-cron.service.js";
import type { ContainerBiddingSaleroom } from "./create-bidding-saleroom.js";
import type { ContainerCatalogServices } from "./create-catalog-services.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerLotLifecycle } from "./create-lot-lifecycle.js";
import type { ContainerPaymentsServices } from "./create-payments-services.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerCronServices = {
  settlementCronService: SettlementCronService;
  accountingReplayCronService: AccountingReplayCronService;
  paymentMaintenanceCronService: PaymentMaintenanceCronService;
  lifecycleCronService: LifecycleCronService;
  hygieneCronService: HygieneCronService;
  accountDeletionEligibilityService: AccountDeletionEligibilityService;
  brevoWebhookIngestService: BrevoWebhookIngestService;
};

export type CreateCronServicesInput = {
  env: Env;
  db: Database;
  authDb: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  payments: ContainerPaymentsServices;
  catalog: ContainerCatalogServices;
  lotLifecycle: ContainerLotLifecycle;
  biddingSaleroom: ContainerBiddingSaleroom;
  complianceMedia: ContainerComplianceMedia;
};

export function createCronServices(input: CreateCronServicesInput): ContainerCronServices {
  const {
    env,
    authDb,
    infra,
    repos,
    platform,
    payments,
    catalog,
    lotLifecycle,
    biddingSaleroom,
    complianceMedia,
  } = input;

  const settlementCronService = new SettlementCronService(
    platform.payoutSettlementService,
    platform.stripeConnectService,
    payments.xeroPayoutBillWriter,
    payments.lotInvoiceInitiationService,
    repos.repoFactory,
    env,
  );

  const accountingReplayCronService = new AccountingReplayCronService(
    repos.paymentRefundReconcileRepository,
    infra.redis,
    env,
    repos.xeroWebhookEventRepository,
    repos.xeroConnRepo,
    payments.accountingProvider,
    payments.xeroPaymentRecorder,
    payments.paymentMaintenanceService,
  );

  const paymentMaintenanceCronService = new PaymentMaintenanceCronService(
    payments.paymentMaintenanceService,
    platform.paymentRefundReconcileService,
  );

  const lifecycleCronService = new LifecycleCronService(
    lotLifecycle.lotLifecycleService,
    lotLifecycle.saleLifecycleService,
    platform.notificationOutboxProcessor,
  );

  const hygieneCronService = new HygieneCronService(
    authDb,
    catalog.itemSubmissionAdminApi,
    complianceMedia.amlService,
    biddingSaleroom.displayPairingService,
  );

  const accountDeletionEligibilityService = new AccountDeletionEligibilityService(
    repos.accountDeletionEligibilityReader,
  );
  const brevoWebhookIngestService = new BrevoWebhookIngestService(
    repos.emailSuppressionRepository,
    repos.emailWebhookIngestRepository,
  );

  return {
    settlementCronService,
    accountingReplayCronService,
    paymentMaintenanceCronService,
    lifecycleCronService,
    hygieneCronService,
    accountDeletionEligibilityService,
    brevoWebhookIngestService,
  };
}
