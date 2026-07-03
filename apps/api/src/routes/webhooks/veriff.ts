import { Hono } from "hono";
import type { Container } from "../../container.js";
import { tryClaimProcessedWebhookEvent } from "../../lib/processed-webhook-event.js";
import {
  VeriffWebhookNotConfiguredError,
  VeriffWebhookSignatureError,
} from "../../lib/veriff/veriff-webhook-verifier.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import {
  KycNotConfiguredError,
  VeriffWebhookPayloadError,
} from "../../services/interfaces/kyc-service.js";
import { progressIndividualsAfterKycApproval } from "../../services/kyc/kyc-post-verification-progression.js";
import { provisionConnectForIndividuals } from "../../services/kyc/provision-connect-after-kyc.js";

type VeriffWebhookSurface = "decision" | "event" | "watchlist";

function recordVeriffWebhookHttpError(surface: VeriffWebhookSurface, status: number): void {
  if (status >= 500) recordMoneyPathEvent(`veriff_webhook_${surface}_5xx`);
  else if (status >= 400) recordMoneyPathEvent(`veriff_webhook_${surface}_4xx`);
}

function webhookErrorResponse(
  surface: VeriffWebhookSurface,
  err: unknown,
): { status: 400 | 401 | 503; body: Record<string, string> } | null {
  if (err instanceof VeriffWebhookNotConfiguredError || err instanceof KycNotConfiguredError) {
    recordVeriffWebhookHttpError(surface, 503);
    return { status: 503, body: { error: "kyc_not_configured" } };
  }
  if (err instanceof VeriffWebhookPayloadError) {
    recordVeriffWebhookHttpError(surface, 400);
    return { status: 400, body: { error: err.message } };
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
    return { status: 401, body: { error: code } };
  }
  const message = err instanceof Error ? err.message : "webhook_error";
  if (message.includes("signature") || message === "missing_veriff_signature") {
    recordVeriffWebhookHttpError(surface, 401);
    return {
      status: 401,
      body: {
        error:
          message === "missing_veriff_signature" ? "missing_veriff_signature" : "invalid_signature",
      },
    };
  }
  if (message.includes("not_configured")) {
    recordVeriffWebhookHttpError(surface, 503);
    return { status: 503, body: { error: "kyc_not_configured" } };
  }
  return null;
}

async function runKycProgression(container: Container, userId: string): Promise<string[]> {
  return (
    (await progressIndividualsAfterKycApproval(
      {
        transactionRunner: container.transactionRunner,
        legalEntityRepository: container.legalEntityRepository,
        domainEventPublisher: container.domainEventPublisher,
      },
      userId,
    )) ?? []
  );
}

/** Best-effort pull of watchlist screening after IDV approval (webhook may have failed). */
async function reconcileWatchlistAfterApproval(
  container: Container,
  providerSessionId: string | null | undefined,
): Promise<void> {
  if (!providerSessionId) return;
  try {
    await container.amlService.ingestFromFetch(providerSessionId);
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

function readVeriffWebhookHeaders(c: {
  req: { header: (name: string) => string | undefined };
}): { signature: string | undefined; authClient: string | undefined } {
  return {
    signature: c.req.header("x-hmac-signature") ?? c.req.header("vrf-hmac-signature"),
    authClient: c.req.header("x-auth-client"),
  };
}

/** Veriff webhook hub — decision (required) and event (optional UX progress). */
export function createVeriffWebhookRoutes(container: Container) {
  const r = new Hono();

  r.post("/decision", async (c) => {
    const raw = await c.req.text();
    const { signature, authClient } = readVeriffWebhookHeaders(c);
    try {
      const result = await container.kycService.handleDecisionWebhook(raw, signature, authClient);
      const { verification: updated, shouldProgressIndividuals } = result;
      const progressionUserId = shouldProgressIndividuals && updated ? updated.userId : null;
      if (progressionUserId) {
        const advancedEntityIds = await runKycProgression(container, progressionUserId);
        await reconcileWatchlistAfterApproval(container, updated?.providerSessionId);
        // Provision Connect accounts now so embedded onboarding is ready when the seller
        // lands on the payout page (no render-time mutation, no first-paint spinner).
        await provisionConnectForIndividuals(container.stripeConnectService, advancedEntityIds);
      }
      if (result.marketingEventToEnqueue) {
        await container.marketingEventService.enqueue(result.marketingEventToEnqueue);
      }
      if (result.resubmissionNotify) {
        const { userId, feedback, providerSessionId, providerAttemptId } =
          result.resubmissionNotify;
        const attemptKey = providerAttemptId ?? "none";
        const notifyEventId = `kyc_resubmit_notify:${providerSessionId}:${attemptKey}`;
        const { claimed } = await tryClaimProcessedWebhookEvent(
          container.db,
          notifyEventId,
          "kyc_resubmit_notify",
        );
        if (claimed) {
          try {
            await container.kycResubmissionNotifier.notify(userId, feedback);
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
      return c.json({ ok: true, processed: Boolean(updated) });
    } catch (err) {
      const mapped = webhookErrorResponse("decision", err);
      if (mapped) return c.json(mapped.body, mapped.status);
      recordVeriffWebhookHttpError("decision", 500);
      throw err;
    }
  });

  r.post("/event", async (c) => {
    const raw = await c.req.text();
    const { signature, authClient } = readVeriffWebhookHeaders(c);
    try {
      await container.kycService.handleEventWebhook(raw, signature, authClient);
      return c.json({ ok: true });
    } catch (err) {
      const mapped = webhookErrorResponse("event", err);
      if (mapped) return c.json(mapped.body, mapped.status);
      throw err;
    }
  });

  // Premium "PEP & Sanctions" watchlist screening + ongoing monitoring updates.
  r.post("/watchlist-screening", async (c) => {
    const raw = await c.req.text();
    const { signature, authClient } = readVeriffWebhookHeaders(c);
    try {
      const result = await container.amlService.handleWatchlistWebhook(raw, signature, authClient);
      if (result.processed && result.outcome) {
        recordMoneyPathEvent(`veriff_watchlist_screening_${result.outcome}`);
      }
      return c.json({ ok: true, processed: result.processed });
    } catch (err) {
      const mapped = webhookErrorResponse("watchlist", err);
      if (mapped) return c.json(mapped.body, mapped.status);
      recordVeriffWebhookHttpError("watchlist", 500);
      throw err;
    }
  });

  return r;
}
