import type { InvoiceDueDateExtender } from "@auction/finance-runtime";
import type { IWatchlistScreeningReader } from "@auction/persistence/interfaces";
import { MuteAwareNotificationWriter } from "@auction/persistence/lib";
import {
  DrizzleNotificationAccountMuteRepository,
  DrizzleNotificationWriteRepository,
  DrizzleUserRepository,
} from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import { VeriffScreeningProvider } from "../lib/veriff/veriff-screening-provider.js";
import { VeriffWatchlistFetcher } from "../lib/veriff/veriff-watchlist-fetcher.js";
import { VeriffWebhookVerifier } from "../lib/veriff/veriff-webhook-verifier.js";
import { DefaultAmlDecisionPolicy } from "../services/aml/aml-decision.policy.js";
import { AmlService } from "../services/aml/aml.service.js";
import type { IKycService } from "../services/interfaces/kyc-service.js";
import { KycNoticeQueue } from "../services/kyc/kyc-notice-queue.js";
import { VeriffKycService } from "../services/kyc/veriff-kyc.service.js";
import type { ComplianceMarketingSlice } from "./create-compliance-marketing.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerComplianceKycAml = {
  kycService: IKycService;
  amlService: AmlService;
  amlScreeningReader: IWatchlistScreeningReader;
};

export type CreateComplianceKycAmlInput = {
  env: Env;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  marketing: Pick<ComplianceMarketingSlice, "marketingEventService">;
  /** Moves invoice due dates when a held buyer is verified. */
  invoiceTerms: Pick<InvoiceDueDateExtender, "extendOpenInvoices">;
};

export function createComplianceKycAml(
  input: CreateComplianceKycAmlInput,
): ContainerComplianceKycAml {
  const { env, infra, repos, platform, marketing, invoiceTerms } = input;
  const { emailService, emailOutbox } = infra;
  const { kycRepository, userRepo, notificationWriteRepo, amlScreeningRepository, amlHoldStore } =
    repos;
  const { domainEventSink } = platform;

  // What a person is told about their identity check is stored in the transaction that applies
  // the decision, so each store is bound to that transaction.
  const notices = new KycNoticeQueue({
    usersFor: (tx) => (tx ? new DrizzleUserRepository(tx) : userRepo),
    notificationsFor: (tx) =>
      tx
        ? new MuteAwareNotificationWriter(
            new DrizzleNotificationWriteRepository(tx),
            new DrizzleNotificationAccountMuteRepository(tx),
          )
        : notificationWriteRepo,
    email: {
      enqueue: (input) => emailService.enqueue(input),
      enqueueInTransaction: (tx, input) => emailOutbox.enqueueInTransaction(tx, input),
    },
    factory: platform.notificationFactory,
    webOrigin: env.WEB_ORIGIN,
  });
  const kycService: IKycService = new VeriffKycService(
    env,
    kycRepository,
    platform.transactionRunner,
    marketing.marketingEventService,
    { invoiceTerms, notices },
  );
  const amlService = new AmlService(
    platform.transactionRunner,
    new VeriffWebhookVerifier(env.VERIFF_API_KEY, env.VERIFF_SHARED_SECRET),
    new DefaultAmlDecisionPolicy(),
    amlScreeningRepository,
    amlScreeningRepository,
    amlHoldStore,
    domainEventSink,
    VeriffScreeningProvider.fromEnv(env),
    VeriffWatchlistFetcher.fromEnv(env),
  );

  return {
    kycService,
    amlService,
    amlScreeningReader: amlScreeningRepository,
  };
}
