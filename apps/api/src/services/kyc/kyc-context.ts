import type { ITransactionRunner } from "@auction/persistence";
import type { IKycSessionRepository } from "@auction/persistence";
import type { IKycRepository } from "@auction/persistence";
import type { Env } from "../../env.js";
import { VeriffClient } from "../../lib/veriff/veriff-client.js";
import { VeriffWebhookVerifier } from "../../lib/veriff/veriff-webhook-verifier.js";
import type { IMarketingEventService } from "../interfaces/marketing-event-service.js";
import { KycDecisionProcessor } from "./kyc-decision-processor.js";

/** Shared KYC service dependencies for session, ingest, and gate services. */
export type KycServiceDeps = {
  sessionRepo: IKycSessionRepository;
  repo: IKycRepository;
  transactionRunner: ITransactionRunner | null;
  veriffClient: VeriffClient;
  webhookVerifier: VeriffWebhookVerifier;
  decisionProcessor: KycDecisionProcessor;
  thresholdAmount: number;
  thresholdCurrency: string;
  webOrigin: string;
  sharedSecret: string | undefined;
};

export function createKycServiceDeps(input: {
  env: Env;
  repo: IKycRepository;
  transactionRunner: ITransactionRunner | null;
  marketingEvents: IMarketingEventService | null;
  veriffClient?: VeriffClient;
}): KycServiceDeps {
  const { env, repo, transactionRunner, marketingEvents, veriffClient } = input;
  return {
    sessionRepo: repo,
    repo,
    transactionRunner,
    veriffClient: veriffClient ?? VeriffClient.fromEnv(env),
    webhookVerifier: new VeriffWebhookVerifier(env.VERIFF_API_KEY, env.VERIFF_SHARED_SECRET),
    decisionProcessor: new KycDecisionProcessor(repo, marketingEvents),
    thresholdAmount: env.KYC_THRESHOLD_AMOUNT,
    thresholdCurrency: env.KYC_THRESHOLD_CURRENCY,
    webOrigin: env.WEB_ORIGIN,
    sharedSecret: env.VERIFF_SHARED_SECRET,
  };
}
