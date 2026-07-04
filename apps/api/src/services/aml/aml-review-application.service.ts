import type { AmlServiceDeps } from "./aml-context.js";
import type { AmlMonitoringService } from "./aml-monitoring.service.js";
import { AML_SCREENING_EVALUATED_EVENT } from "./aml-webhook-ingest.service.js";
import type {
  AmlReviewInput,
  AmlTriageInput,
  IAmlReviewApplicationService,
  WatchlistScreeningRecord,
} from "./ports.js";

export class AmlReviewApplicationService implements IAmlReviewApplicationService {
  constructor(
    private readonly deps: AmlServiceDeps,
    private readonly monitoring: AmlMonitoringService = deps.monitoring,
  ) {}

  async listPendingReviews(limit = 50, offset = 0): Promise<WatchlistScreeningRecord[]> {
    return this.deps.screeningReader.listByReviewStatus("pending", limit, offset);
  }

  async countPendingReviews(): Promise<number> {
    return this.deps.screeningReader.countByReviewStatus("pending");
  }

  async listForUser(userId: string, limit = 20): Promise<WatchlistScreeningRecord[]> {
    return this.deps.screeningReader.listForUser(userId, limit);
  }

  async triage(input: AmlTriageInput): Promise<WatchlistScreeningRecord> {
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      const record = await this.deps.screeningReader.findById(input.screeningId, tx);
      if (!record) throw new Error("aml_screening_not_found");
      if (record.userId === input.analystUserId) {
        throw new Error("aml_triage_self_forbidden");
      }
      if (record.reviewStatus !== "pending") {
        throw new Error("aml_screening_not_pending");
      }
      if (record.triageRecommendation) {
        throw new Error("aml_triage_already_set");
      }
      const recommendation =
        input.recommendation === "clear" ? "recommend_clear" : "recommend_block";
      const updated = await this.deps.screeningWriter.setTriage(
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

  async decide(input: AmlReviewInput): Promise<WatchlistScreeningRecord> {
    const updated = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const record = await this.deps.screeningReader.findById(input.screeningId, tx);
      if (!record) throw new Error("aml_screening_not_found");
      if (record.userId === input.reviewerUserId) {
        throw new Error("aml_review_self_forbidden");
      }
      if (record.reviewStatus !== "pending") {
        throw new Error("aml_screening_not_pending");
      }
      if (!record.triagedByUserId || !record.triageRecommendation) {
        throw new Error("aml_triage_required");
      }
      if (record.triagedByUserId === input.reviewerUserId) {
        throw new Error("aml_review_same_as_triager");
      }

      const reviewStatus = input.decision === "clear" ? "cleared" : "blocked";
      const updated = await this.deps.screeningWriter.setReviewOutcome(
        input.screeningId,
        { reviewStatus, reviewedByUserId: input.reviewerUserId, reviewNotes: input.notes },
        tx,
      );
      if (!updated) throw new Error("aml_screening_not_pending");

      if (input.decision === "clear") {
        await this.deps.holdStore.clearHold(record.userId, tx);
      } else {
        await this.deps.holdStore.setHold(record.userId, "blocked", "sanctions_match", tx);
      }

      await this.deps.events.withTx(tx).publish({
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

    if (input.decision === "clear" && updated.monitorStatus !== "monitored") {
      await this.monitoring.tryEnableMonitoring(updated.providerSessionId);
    }
    return updated;
  }
}
