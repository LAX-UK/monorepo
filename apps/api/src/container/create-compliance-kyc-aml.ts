import type { InvoiceDueDateExtender } from "@auction/finance-runtime";
import type { IWatchlistScreeningReader } from "@auction/persistence/interfaces";
import type { Env } from "../env.js";
import { VeriffScreeningProvider } from "../lib/veriff/veriff-screening-provider.js";
import { VeriffWatchlistFetcher } from "../lib/veriff/veriff-watchlist-fetcher.js";
import { VeriffWebhookVerifier } from "../lib/veriff/veriff-webhook-verifier.js";
import { DefaultAmlDecisionPolicy } from "../services/aml/aml-decision.policy.js";
import { AmlService } from "../services/aml/aml.service.js";
import type { IKycService } from "../services/interfaces/kyc-service.js";
import { KycOutcomeNotifier } from "../services/kyc/kyc-outcome-notifier.js";
import { KycResubmissionNotifier } from "../services/kyc/kyc-resubmission-notifier.js";
import { VeriffKycService } from "../services/kyc/veriff-kyc.service.js";
import type { ComplianceMarketingSlice } from "./create-compliance-marketing.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerComplianceKycAml = {
  kycService: IKycService;
  kycResubmissionNotifier: KycResubmissionNotifier;
  kycOutcomeNotifier: KycOutcomeNotifier;
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
  const { emailService } = infra;
  const { kycRepository, userRepo, notificationWriteRepo, amlScreeningRepository, amlHoldStore } =
    repos;
  const { domainEventSink } = platform;

  const kycService: IKycService = new VeriffKycService(
    env,
    kycRepository,
    platform.transactionRunner,
    marketing.marketingEventService,
    { invoiceTerms },
  );
  const kycResubmissionNotifier = new KycResubmissionNotifier(
    userRepo,
    emailService,
    notificationWriteRepo,
    env.WEB_ORIGIN,
  );
  const kycOutcomeNotifier = new KycOutcomeNotifier(
    userRepo,
    emailService,
    notificationWriteRepo,
    platform.notificationFactory,
    env.WEB_ORIGIN,
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
    kycResubmissionNotifier,
    kycOutcomeNotifier,
    amlService,
    amlScreeningReader: amlScreeningRepository,
  };
}
