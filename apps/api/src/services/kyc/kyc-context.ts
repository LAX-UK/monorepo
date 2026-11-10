import type { InvoiceDueDateExtender } from "@auction/finance-runtime";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { IKycSessionRepository } from "@auction/persistence/interfaces";
import type { IKycRepository } from "@auction/persistence/interfaces";
import type { Env } from "../../env.js";
import { VeriffClient } from "../../lib/veriff/veriff-client.js";
import { VeriffWebhookVerifier } from "../../lib/veriff/veriff-webhook-verifier.js";
import type { IMarketingEventService } from "../interfaces/marketing-event-service.js";
import { KycDecisionProcessor } from "./kyc-decision-processor.js";
import type { IKycNoticeQueue } from "./kyc-notice-queue.js";

/** Shared KYC service dependencies for session, ingest, and gate services. */
export type KycServiceDeps = {
  sessionRepo: IKycSessionRepository;
  repo: IKycRepository;
  transactionRunner: ITransactionRunner | null;
  veriffClient: VeriffClient;
  webhookVerifier: VeriffWebhookVerifier;
  decisionProcessor: KycDecisionProcessor;
  /** Queues what the person is told, in the decision's transaction; null where nobody is told. */
  notices: IKycNoticeQueue | null;
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
  invoiceTerms: Pick<InvoiceDueDateExtender, "extendOpenInvoices"> | null;
  veriffClient?: VeriffClient;
  notices?: IKycNoticeQueue | null;
}): KycServiceDeps {
  const { env, repo, transactionRunner, marketingEvents, invoiceTerms, veriffClient } = input;
  const notices = input.notices ?? null;
  return {
    sessionRepo: repo,
    repo,
    transactionRunner,
    veriffClient: veriffClient ?? VeriffClient.fromEnv(env),
    webhookVerifier: new VeriffWebhookVerifier(env.VERIFF_API_KEY, env.VERIFF_SHARED_SECRET),
    decisionProcessor: new KycDecisionProcessor(repo, marketingEvents, invoiceTerms),
    notices,
    thresholdAmount: env.KYC_THRESHOLD_AMOUNT,
    thresholdCurrency: env.KYC_THRESHOLD_CURRENCY,
    webOrigin: env.WEB_ORIGIN,
    sharedSecret: env.VERIFF_SHARED_SECRET,
  };
}
