import type { Database } from "@auction/db";
import type { Env } from "../../env.js";
import type { VeriffClient } from "../../lib/veriff/veriff-client.js";
import { VeriffWebhookSignatureError } from "../../lib/veriff/veriff-webhook-verifier.js";
import type { IKycRepository } from "../interfaces/kyc-repository.js";
import type { IKycService } from "../interfaces/kyc-service.js";
import type { IMarketingEventService } from "../interfaces/marketing-event-service.js";
import { createKycServiceDeps } from "./kyc-context.js";
import { KycGateService } from "./kyc-gate.service.js";
import { KycSessionService } from "./kyc-session.service.js";
import { KycWebhookIngestService } from "./kyc-webhook-ingest.service.js";

/**
 * KYC migration facade. Delegates to segregated session, webhook ingest, and
 * gate services while preserving the original public surface for container wiring.
 */
export class VeriffKycService implements IKycService {
  private readonly session: KycSessionService;
  private readonly ingest: KycWebhookIngestService;
  private readonly gate: KycGateService;

  constructor(
    env: Env,
    repo: IKycRepository,
    db: Database | null = null,
    marketingEvents: IMarketingEventService | null = null,
    veriffClient?: VeriffClient,
  ) {
    const deps = createKycServiceDeps({
      env,
      repo,
      db,
      marketingEvents,
      ...(veriffClient !== undefined ? { veriffClient } : {}),
    });
    this.session = new KycSessionService(
      deps.sessionRepo,
      deps.veriffClient,
      deps.sharedSecret,
      deps.webOrigin,
    );
    this.ingest = new KycWebhookIngestService(deps, deps.webhookVerifier);
    this.gate = new KycGateService(deps.repo, deps.thresholdAmount, deps.thresholdCurrency);
  }

  isConfigured(...args: Parameters<KycSessionService["isConfigured"]>) {
    return this.session.isConfigured(...args);
  }

  createSession(...args: Parameters<KycSessionService["createSession"]>) {
    return this.session.createSession(...args);
  }

  getLatestForUser(...args: Parameters<KycSessionService["getLatestForUser"]>) {
    return this.session.getLatestForUser(...args);
  }

  handleDecisionWebhook(...args: Parameters<KycWebhookIngestService["handleDecisionWebhook"]>) {
    return this.ingest.handleDecisionWebhook(...args);
  }

  handleEventWebhook(...args: Parameters<KycWebhookIngestService["handleEventWebhook"]>) {
    return this.ingest.handleEventWebhook(...args);
  }

  getStatus(...args: Parameters<KycGateService["getStatus"]>) {
    return this.gate.getStatus(...args);
  }

  enforceThreshold(...args: Parameters<KycGateService["enforceThreshold"]>) {
    return this.gate.enforceThreshold(...args);
  }
}

export { VeriffWebhookSignatureError };
