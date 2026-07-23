import type { Database } from "@auction/db";
import type { ILegalEntityRepository, ITransactionRunner } from "@auction/persistence/interfaces";
import { tryClaimProcessedWebhookEvent } from "../../lib/processed-webhook-event.js";
import {
  VeriffWebhookNotConfiguredError,
  VeriffWebhookSignatureError,
} from "../../lib/veriff/veriff-webhook-verifier.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { AmlService } from "../aml/aml.service.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  IVeriffWebhookIngressApplicationService,
  VeriffWebhookHttpResult,
} from "../interfaces/compliance-routes/compliance-veriff-webhook-ingress.js";
import type { IKycService } from "../interfaces/kyc-service.js";
import { KycNotConfiguredError, VeriffWebhookPayloadError } from "../interfaces/kyc-service.js";
import type { IMarketingEventService } from "../interfaces/marketing-event-service.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";
import { progressIndividualsAfterKycApproval } from "../kyc/kyc-post-verification-progression.js";
import type { KycResubmissionNotifier } from "../kyc/kyc-resubmission-notifier.js";
import { provisionConnectForIndividuals } from "../kyc/provision-connect-after-kyc.js";

type VeriffWebhookSurface = "decision" | "event" | "watchlist";

function recordVeriffWebhookHttpError(surface: VeriffWebhookSurface, status: number): void {
  if (status >= 500) recordMoneyPathEvent(`veriff_webhook_${surface}_5xx`);
  else if (status >= 400) recordMoneyPathEvent(`veriff_webhook_${surface}_4xx`);
}

function webhookErrorResponse(
  surface: VeriffWebhookSurface,
  err: unknown,
): VeriffWebhookHttpResult | null {
  if (err instanceof VeriffWebhookNotConfiguredError || err instanceof KycNotConfiguredError) {
    recordVeriffWebhookHttpError(surface, 503);
    return { ok: false, status: 503, body: { error: "kyc_not_configured" } };
  }
  if (err instanceof VeriffWebhookPayloadError) {
    recordVeriffWebhookHttpError(surface, 400);
    return { ok: false, status: 400, body: { error: err.message } };
  }
  if (err instanceof VeriffWebhookSignatureError) {
    recordVeriffWebhookHttpError(surface, 401);
    const code =
      err.message === "missing_veriff_signature"
        ? "missing_veriff_signature"
        : err.message === "missing_veriff_auth_client"
          ? "missing_veriff_auth_client"
          : err.message === "invalid_auth_client"
            ? "invalid_auth_client"
            : "invalid_signature";
    return { ok: false, status: 401, body: { error: code } };
  }
  const message = err instanceof Error ? err.message : "webhook_error";
  if (message.includes("signature") || message === "missing_veriff_signature") {
    recordVeriffWebhookHttpError(surface, 401);
    return {
      ok: false,
      status: 401,
      body: {
        error:
          message === "missing_veriff_signature" ? "missing_veriff_signature" : "invalid_signature",
      },
    };
  }
  if (message.includes("not_configured")) {
    recordVeriffWebhookHttpError(surface, 503);
    return { ok: false, status: 503, body: { error: "kyc_not_configured" } };
  }
  return null;
}

export type VeriffWebhookIngressApplicationServiceDeps = {
  db: Database;
  transactionRunner: ITransactionRunner;
  legalEntityRepository: ILegalEntityRepository;
  domainEventSink: IDomainEventSink | undefined;
  kycService: IKycService;
  amlService: AmlService;
  stripeConnectService: IStripeConnectService;
  marketingEventService: IMarketingEventService;
  kycResubmissionNotifier: KycResubmissionNotifier;
};

export class VeriffWebhookIngressApplicationService
  implements IVeriffWebhookIngressApplicationService
{
  constructor(private readonly deps: VeriffWebhookIngressApplicationServiceDeps) {}

  private async runKycProgression(userId: string): Promise<string[]> {
    return (
      (await progressIndividualsAfterKycApproval(
        {
          transactionRunner: this.deps.transactionRunner,
          legalEntityRepository: this.deps.legalEntityRepository,
          domainEventSink: this.deps.domainEventSink,
        },
        userId,
      )) ?? []
    );
  }

  private async reconcileWatchlistAfterApproval(
    providerSessionId: string | null | undefined,
  ): Promise<void> {
    if (!providerSessionId) return;
    try {
      await this.deps.amlService.ingestFromFetch(providerSessionId);
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "aml_watchlist_reconcile_failed",
          providerSessionId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  async handleDecisionWebhook(input: {
    rawBody: string;
    signature: string | undefined;
    authClient: string | undefined;
  }): Promise<VeriffWebhookHttpResult> {
    try {
      const result = await this.deps.kycService.handleDecisionWebhook(
        input.rawBody,
        input.signature,
        input.authClient,
      );
      const { verification: updated, shouldProgressIndividuals } = result;
      const progressionUserId = shouldProgressIndividuals && updated ? updated.userId : null;
      if (progressionUserId) {
        const advancedEntityIds = await this.runKycProgression(progressionUserId);
        await this.reconcileWatchlistAfterApproval(updated?.providerSessionId);
        await provisionConnectForIndividuals(this.deps.stripeConnectService, advancedEntityIds);
      }
      if (result.marketingEventToEnqueue) {
        await this.deps.marketingEventService.enqueue(result.marketingEventToEnqueue);
      }
      if (result.resubmissionNotify) {
        const { userId, feedback, providerSessionId, providerAttemptId } =
          result.resubmissionNotify;
        const attemptKey = providerAttemptId ?? "none";
        const notifyEventId = `kyc_resubmit_notify:${providerSessionId}:${attemptKey}`;
        const { claimed } = await tryClaimProcessedWebhookEvent(
          this.deps.db,
          notifyEventId,
          "kyc_resubmit_notify",
        );
        if (claimed) {
          try {
            await this.deps.kycResubmissionNotifier.notify(userId, feedback);
          } catch (err) {
            console.error(
              JSON.stringify({
                msg: "kyc_resubmission_notify_failed",
                userId,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          }
        }
      }
      return { ok: true, status: 200, body: { ok: true, processed: Boolean(updated) } };
    } catch (err) {
      const mapped = webhookErrorResponse("decision", err);
      if (mapped) return mapped;
      recordVeriffWebhookHttpError("decision", 500);
      throw err;
    }
  }

  async handleEventWebhook(input: {
    rawBody: string;
    signature: string | undefined;
    authClient: string | undefined;
  }): Promise<VeriffWebhookHttpResult> {
    try {
      await this.deps.kycService.handleEventWebhook(
        input.rawBody,
        input.signature,
        input.authClient,
      );
      return { ok: true, status: 200, body: { ok: true } };
    } catch (err) {
      const mapped = webhookErrorResponse("event", err);
      if (mapped) return mapped;
      throw err;
    }
  }

  async handleWatchlistWebhook(input: {
    rawBody: string;
    signature: string | undefined;
    authClient: string | undefined;
  }): Promise<VeriffWebhookHttpResult> {
    try {
      const result = await this.deps.amlService.handleWatchlistWebhook(
        input.rawBody,
        input.signature,
        input.authClient,
      );
      if (result.processed && result.outcome) {
        recordMoneyPathEvent(`veriff_watchlist_screening_${result.outcome}`);
      }
      return { ok: true, status: 200, body: { ok: true, processed: result.processed } };
    } catch (err) {
      const mapped = webhookErrorResponse("watchlist", err);
      if (mapped) return mapped;
      recordVeriffWebhookHttpError("watchlist", 500);
      throw err;
    }
  }
}
