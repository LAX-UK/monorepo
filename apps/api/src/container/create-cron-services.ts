import type { Database } from "@auction/db";
import { AccountingReplayCronService } from "@auction/finance-cron-app";
import { LifecycleCronService, PaymentMaintenanceCronService } from "@auction/finance-cron-app";
import type { Env } from "../env.js";
import { AccountDeletionEligibilityService } from "../services/account-deletion-eligibility.service.js";
import { proactiveRefreshXeroTokens } from "../services/accounting/xero-auth-runtime.js";
import { BrevoWebhookIngestService } from "../services/brevo-webhook-ingest.service.js";
import { HygieneCronService } from "../services/cron/hygiene-cron.service.js";
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
    repos.xeroWebhookEventRepository,
    payments.accountingProvider,
    payments.xeroPaymentRecorder,
    payments.paymentMaintenanceService,
    repos.paymentRepo,
    repos.payoutRepository,
    {
      isConfigured: () =>
        Boolean(env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET && env.XERO_REDIRECT_URI),
      refresh: async () => {
        const result = await proactiveRefreshXeroTokens({
          env,
          connections: repos.xeroConnRepo,
          redis: infra.redis,
        });
        if (!result.ok) {
          return {
            ok: false as const,
            error: result.reason,
            status: result.reason === "not_connected" ? 200 : 502,
            result,
          };
        }
        return { ok: true as const, result };
      },
    },
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
