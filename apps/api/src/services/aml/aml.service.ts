import { createHash } from "node:crypto";
import type { Database } from "@auction/db";
import { kycVerification } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { tryClaimProcessedWebhookEvent } from "../../lib/processed-webhook-event.js";
import { veriffWatchlistWebhookSchema } from "../../lib/veriff/veriff-watchlist-types.js";
import type { VeriffWebhookVerifier } from "../../lib/veriff/veriff-webhook-verifier.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import { VeriffWebhookPayloadError } from "../interfaces/kyc-service.js";
import type {
  AmlDecision,
  AmlHoldReason,
  AmlReviewStatus,
  AmlScreeningResult,
} from "./aml-types.js";
import type {
  IAmlDecisionPolicy,
  IAmlHoldStore,
  IScreeningProvider,
  IWatchlistScreeningReader,
  IWatchlistScreeningWriter,
  WatchlistScreeningRecord,
} from "./ports.js";
import { normalizeVeriffWatchlistWebhook } from "./veriff-watchlist-normalizer.js";

export const AML_SCREENING_EVALUATED_EVENT = "aml.screening_evaluated";
export const AML_MATCH_FLAGGED_EVENT = "aml.match_flagged";

export type AmlWatchlistWebhookResult = {
  processed: boolean;
  outcome: AmlDecision["outcome"] | null;
};

export type AmlTriageInput = {
  screeningId: string;
  analystUserId: string;
  /** Advisory recommendation; the MLRO makes the binding decision. */
  recommendation: "clear" | "block";
  notes: string | null;
};

export type AmlReviewInput = {
  screeningId: string;
  reviewerUserId: string;
  /** `clear` lifts the hold; `block` escalates to a terminal block. */
  decision: "clear" | "block";
  notes: string | null;
};

/** Maps a decision + result onto the persisted hold reason. */
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

/**
 * AML application service. Owns watchlist screening ingest, MLRO review, and the
 * ongoing-monitoring lifecycle. Depends only on ports (Dependency Inversion), so
 * the provider, persistence, and policy are all swappable.
 */
export class AmlService {
  constructor(
    private readonly db: Database,
    private readonly verifier: VeriffWebhookVerifier,
    private readonly policy: IAmlDecisionPolicy,
    private readonly screeningWriter: IWatchlistScreeningWriter,
    private readonly screeningReader: IWatchlistScreeningReader,
    private readonly holdStore: IAmlHoldStore,
    private readonly events: DomainEventPublisher,
    private readonly provider: IScreeningProvider,
  ) {}

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  /**
   * Handle a Veriff `watchlist-screening` webhook. Verifies the signature,
   * normalizes the payload, evaluates the pure policy, then atomically claims
   * idempotency, persists the result, sets/clears the AML hold, and emits the
   * outbox domain events.
   */
  async handleWatchlistWebhook(
    rawBody: string,
    signature: string | undefined,
    authClient: string | undefined,
  ): Promise<AmlWatchlistWebhookResult> {
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
    const providerSessionId = normalized.providerSessionId;
    if (!providerSessionId) {
      throw new VeriffWebhookPayloadError("missing_provider_session_id");
    }
    const subjectFromPayload = normalized.userId;
    const result: AmlScreeningResult = {
      ...normalized.result,
      providerSessionId,
    };
    const decision = this.policy.evaluate(result);
    const reviewStatus = reviewStatusFor(decision);
    // Content hash dedupes exact re-deliveries while allowing genuine monitoring updates.
    const eventId = `veriff_watchlist:${createHash("sha256").update(rawBody).digest("hex")}`;

    const txResult = await this.db.transaction(async (tx) => {
      const { claimed } = await tryClaimProcessedWebhookEvent(tx, eventId, "veriff_watchlist");
      if (!claimed) {
        return { processed: false, outcome: null, alreadyMonitored: true };
      }

      const userId = await this.resolveUserId(subjectFromPayload, providerSessionId, tx);
      if (!userId) {
        throw new VeriffWebhookPayloadError("unknown_screening_subject");
      }

      const record = await this.screeningWriter.upsertFromResult(
        { userId, result, decision, reviewStatus },
        tx,
      );

      if (decision.outcome === "block") {
        await this.holdStore.setHold(userId, "blocked", holdReasonFor(decision, result), tx);
      } else if (decision.outcome === "review") {
        await this.holdStore.setHold(userId, "hold", holdReasonFor(decision, result), tx);
      } else {
        // Only clear a hold that was set by screening (never override a manual block here).
        const existing = await this.holdStore.getHold(userId, tx);
        if (existing && existing.status !== "blocked") {
          await this.holdStore.clearHold(userId, tx);
        }
      }

      await this.publishScreeningEvents(tx, record, result, decision);
      return {
        processed: true,
        outcome: decision.outcome,
        alreadyMonitored: record.monitorStatus === "monitored",
      };
    });

    // Enrol clear subjects into ongoing monitoring (best-effort, off the tx path).
    if (txResult.processed && txResult.outcome === "clear" && !txResult.alreadyMonitored) {
      await this.tryEnableMonitoring(providerSessionId);
    }
    return { processed: txResult.processed, outcome: txResult.outcome };
  }

  /** Pending watchlist screenings awaiting MLRO/compliance review. */
  async listPendingReviews(limit = 50): Promise<WatchlistScreeningRecord[]> {
    return this.screeningReader.listByReviewStatus("pending", limit);
  }

  /**
   * First-line analyst triage (maker). Records an advisory recommendation only;
   * it does NOT change the hold. The binding decision is made by a different
   * MLRO via `decide` (maker-checker / four-eyes).
   */
  async triage(input: AmlTriageInput): Promise<WatchlistScreeningRecord> {
    return this.db.transaction(async (tx) => {
      const record = await this.screeningReader.findById(input.screeningId, tx);
      if (!record) throw new Error("aml_screening_not_found");
      if (record.userId === input.analystUserId) {
        // A subject can never triage their own screening.
        throw new Error("aml_triage_self_forbidden");
      }
      if (record.reviewStatus !== "pending") {
        // Only an open (pending) screening can be triaged.
        throw new Error("aml_screening_not_pending");
      }
      if (record.triageRecommendation) {
        throw new Error("aml_triage_already_set");
      }
      const recommendation =
        input.recommendation === "clear" ? "recommend_clear" : "recommend_block";
      const updated = await this.screeningWriter.setTriage(
        input.screeningId,
        {
          recommendation,
          triagedByUserId: input.analystUserId,
          triageNotes: input.notes,
        },
        tx,
      );
      if (!updated) throw new Error("aml_triage_already_set");
      return updated;
    });
  }

  /**
   * MLRO (checker) binding decision. Enforces maker-checker: the decider must be
   * a different user from both the subject and the analyst who triaged, and a
   * triage recommendation must already exist.
   */
  async decide(input: AmlReviewInput): Promise<WatchlistScreeningRecord> {
    const updated = await this.db.transaction(async (tx) => {
      const record = await this.screeningReader.findById(input.screeningId, tx);
      if (!record) throw new Error("aml_screening_not_found");
      if (record.userId === input.reviewerUserId) {
        // A subject can never decide their own screening.
        throw new Error("aml_review_self_forbidden");
      }
      if (record.reviewStatus !== "pending") {
        throw new Error("aml_screening_not_pending");
      }
      if (!record.triagedByUserId || !record.triageRecommendation) {
        // Maker-checker: a first-line triage must precede the MLRO decision.
        throw new Error("aml_triage_required");
      }
      if (record.triagedByUserId === input.reviewerUserId) {
        // Maker-checker: the checker must differ from the maker.
        throw new Error("aml_review_same_as_triager");
      }

      const reviewStatus = input.decision === "clear" ? "cleared" : "blocked";
      const updated = await this.screeningWriter.setReviewOutcome(
        input.screeningId,
        { reviewStatus, reviewedByUserId: input.reviewerUserId, reviewNotes: input.notes },
        tx,
      );
      if (!updated) throw new Error("aml_screening_not_pending");

      if (input.decision === "clear") {
        await this.holdStore.clearHold(record.userId, tx);
      } else {
        // Settlement gate checks hold presence only; reason is audit metadata.
        await this.holdStore.setHold(record.userId, "blocked", "sanctions_match", tx);
      }

      await this.events.publish(tx, {
        aggregateType: "aml_screening",
        aggregateId: updated.id,
        eventType: AML_SCREENING_EVALUATED_EVENT,
        actorUserId: input.reviewerUserId,
        payload: {
          screeningId: updated.id,
          userId: updated.userId,
          outcome: input.decision === "clear" ? "clear" : "block",
          matchStatus: updated.matchStatus,
          monitorStatus: updated.monitorStatus,
          categories: updated.categories.join(","),
          reasons: `manual_${reviewStatus}`,
        },
      });
      return updated;
    });

    // A cleared subject re-enters ongoing monitoring so future hits re-flag them.
    if (input.decision === "clear" && updated.monitorStatus !== "monitored") {
      await this.tryEnableMonitoring(updated.providerSessionId);
    }
    return updated;
  }

  /** Enrol a verified session into ongoing monitoring (best-effort; never blocks). */
  async enableMonitoring(providerSessionId: string): Promise<void> {
    if (!this.provider.isConfigured()) return;
    await this.provider.enableOngoingMonitoring(providerSessionId);
    await this.screeningWriter.setMonitorStatus(providerSessionId, "monitored");
  }

  /** Best-effort monitoring enrolment that never throws into the caller. */
  private async tryEnableMonitoring(providerSessionId: string): Promise<void> {
    try {
      await this.enableMonitoring(providerSessionId);
    } catch {
      // Monitoring is non-critical to the screening decision; failures are
      // retried on the next webhook/review and surface via provider logs.
    }
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

    await this.events.publish(tx, {
      aggregateType: "aml_screening",
      aggregateId: record.id,
      eventType: AML_SCREENING_EVALUATED_EVENT,
      actorUserId: record.userId,
      payload: basePayload,
    });

    if (decision.outcome !== "clear") {
      await this.events.publish(tx, {
        aggregateType: "aml_screening",
        aggregateId: record.id,
        eventType: AML_MATCH_FLAGGED_EVENT,
        actorUserId: record.userId,
        payload: basePayload,
      });
    }
  }
}
