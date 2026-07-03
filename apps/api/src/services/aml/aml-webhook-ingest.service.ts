import { createHash } from "node:crypto";
import type { Database } from "@auction/db";
import { kycVerification } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { tryClaimProcessedWebhookEvent } from "../../lib/processed-webhook-event.js";
import {
  type NormalizedWatchlistScreening,
  normalizeVeriffWatchlistWebhook,
} from "../../lib/veriff/veriff-watchlist-normalizer.js";
import { veriffWatchlistWebhookSchema } from "../../lib/veriff/veriff-watchlist-types.js";
import type { VeriffWebhookVerifier } from "../../lib/veriff/veriff-webhook-verifier.js";
import { VeriffWebhookPayloadError } from "../interfaces/kyc-service.js";
import type { AmlServiceDeps } from "./aml-context.js";
import type { AmlMonitoringService } from "./aml-monitoring.service.js";
import type {
  AmlDecision,
  AmlHoldReason,
  AmlReviewStatus,
  AmlScreeningResult,
} from "./aml-types.js";
import type {
  IAmlWebhookIngestService,
  IWatchlistScreeningFetcher,
  WatchlistScreeningRecord,
} from "./ports.js";

export const AML_SCREENING_EVALUATED_EVENT = "aml.screening_evaluated";
export const AML_MATCH_FLAGGED_EVENT = "aml.match_flagged";

function holdReasonFor(decision: AmlDecision, result: AmlScreeningResult): AmlHoldReason {
  if (decision.outcome === "block") return "sanctions_match";
  if (result.categories.includes("pep")) return "pep_match";
  if (result.categories.includes("adverse_media")) return "adverse_media_match";
  return "screening_review";
}

function reviewStatusFor(decision: AmlDecision): AmlReviewStatus {
  if (decision.outcome === "clear") return "not_required";
  if (decision.outcome === "block") return "blocked";
  return "pending";
}

type ApplyScreeningResult = {
  processed: boolean;
  outcome: AmlDecision["outcome"] | null;
  alreadyMonitored: boolean;
  record: WatchlistScreeningRecord | null;
};

export class AmlWebhookIngestService implements IAmlWebhookIngestService {
  constructor(
    private readonly deps: AmlServiceDeps,
    private readonly verifier: VeriffWebhookVerifier,
    private readonly fetcher: IWatchlistScreeningFetcher | null = null,
    private readonly monitoring: AmlMonitoringService = deps.monitoring,
  ) {}

  async handleWatchlistWebhook(
    rawBody: string,
    signature: string | undefined,
    authClient: string | undefined,
  ) {
    this.verifier.verify(rawBody, signature, authClient);

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new VeriffWebhookPayloadError("invalid_json");
    }
    const parsed = veriffWatchlistWebhookSchema.safeParse(json);
    if (!parsed.success) {
      throw new VeriffWebhookPayloadError("invalid_watchlist_payload");
    }

    const normalized = normalizeVeriffWatchlistWebhook(parsed.data);
    const eventId = `veriff_watchlist:${createHash("sha256").update(rawBody).digest("hex")}`;
    const txResult = await this.applyScreening(normalized, eventId, "veriff_watchlist");
    return { processed: txResult.processed, outcome: txResult.outcome };
  }

  async ingestFromFetch(providerSessionId: string) {
    if (!this.fetcher?.isConfigured()) {
      throw new Error("aml_fetch_not_configured");
    }
    const normalized = await this.fetcher.fetchBySessionId(providerSessionId);
    if (!normalized) {
      return { processed: false, outcome: null };
    }
    const eventId = `veriff_watchlist_fetch:${providerSessionId}:${normalized.checkType ?? "unknown"}`;
    const txResult = await this.applyScreening(normalized, eventId, "veriff_watchlist");
    return { processed: txResult.processed, outcome: txResult.outcome };
  }

  private async applyScreening(
    normalized: NormalizedWatchlistScreening,
    eventId: string,
    eventSource: string,
  ): Promise<ApplyScreeningResult> {
    const providerSessionId = normalized.providerSessionId;
    if (!providerSessionId) {
      throw new VeriffWebhookPayloadError("missing_provider_session_id");
    }

    const subjectFromPayload = normalized.userId;
    const result: AmlScreeningResult = {
      ...normalized.result,
      providerSessionId,
    };
    const decision = this.deps.policy.evaluate(result);
    const reviewStatus = reviewStatusFor(decision);

    const txResult = await this.deps.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedWebhookEvent(tx, eventId, eventSource);
      if (!claimed) {
        return {
          processed: false,
          outcome: null,
          alreadyMonitored: true,
          record: null,
        };
      }

      const userId = await this.resolveUserId(subjectFromPayload, providerSessionId, tx);
      if (!userId) {
        throw new VeriffWebhookPayloadError("unknown_screening_subject");
      }

      const record = await this.deps.screeningWriter.upsertFromResult(
        {
          userId,
          result,
          decision,
          reviewStatus,
          checkType: normalized.checkType,
        },
        tx,
      );

      if (decision.outcome === "block") {
        await this.deps.holdStore.setHold(userId, "blocked", holdReasonFor(decision, result), tx);
      } else if (decision.outcome === "review") {
        await this.deps.holdStore.setHold(userId, "hold", holdReasonFor(decision, result), tx);
      } else {
        const existing = await this.deps.holdStore.getHold(userId, tx);
        if (existing && existing.status !== "blocked") {
          await this.deps.holdStore.clearHold(userId, tx);
        }
      }

      await this.publishScreeningEvents(tx, record, result, decision);
      return {
        processed: true,
        outcome: decision.outcome,
        alreadyMonitored: record.monitorStatus === "monitored",
        record,
      };
    });

    if (txResult.processed && txResult.outcome === "clear" && !txResult.alreadyMonitored) {
      await this.monitoring.tryEnableMonitoring(providerSessionId);
    }
    return txResult;
  }

  private async resolveUserId(
    fromPayload: string | null,
    providerSessionId: string,
    tx: Database,
  ): Promise<string | null> {
    if (fromPayload) return fromPayload;
    const rows = await tx
      .select({ userId: kycVerification.userId })
      .from(kycVerification)
      .where(eq(kycVerification.providerSessionId, providerSessionId))
      .limit(1);
    return rows[0]?.userId ?? null;
  }

  private async publishScreeningEvents(
    tx: Database,
    record: WatchlistScreeningRecord,
    result: AmlScreeningResult,
    decision: AmlDecision,
  ): Promise<void> {
    const basePayload = {
      screeningId: record.id,
      userId: record.userId,
      providerSessionId: record.providerSessionId,
      outcome: decision.outcome,
      matchStatus: result.matchStatus,
      monitorStatus: result.monitorStatus,
      totalHits: result.totalHits,
      categories: result.categories.join(","),
      reasons: decision.reasons.join(","),
    };

    await this.deps.events.publish(tx, {
      aggregateType: "aml_screening",
      aggregateId: record.id,
      eventType: AML_SCREENING_EVALUATED_EVENT,
      actorUserId: record.userId,
      payload: basePayload,
    });

    if (decision.outcome !== "clear") {
      await this.deps.events.publish(tx, {
        aggregateType: "aml_screening",
        aggregateId: record.id,
        eventType: AML_MATCH_FLAGGED_EVENT,
        actorUserId: record.userId,
        payload: basePayload,
      });
    }
  }
}
