import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type {
  ISourceOfFundsReviewService,
  SourceOfFundsDecideCommand,
  SourceOfFundsTriageCommand,
} from "../interfaces/source-of-funds-service.js";
import { SOURCE_OF_FUNDS_REQUIRED_EVENT } from "./source-of-funds-gate.service.js";
import type {
  ISourceOfFundsRepository,
  SourceOfFundsCase,
  SourceOfFundsStatus,
} from "./source-of-funds.types.js";

export const SOURCE_OF_FUNDS_REVIEWED_EVENT = "source_of_funds.reviewed";

/**
 * Admin triage: maker-checker review workflow and case listing.
 */
export class SourceOfFundsReviewService implements ISourceOfFundsReviewService {
  constructor(
    private readonly repo: ISourceOfFundsRepository,
    private readonly transactionRunner: ITransactionRunner | null = null,
    private readonly events: DomainEventPublisher | null = null,
  ) {}

  async listPending(limit = 50): Promise<SourceOfFundsCase[]> {
    return this.listByStatus("pending", limit);
  }

  async countPending(): Promise<number> {
    return this.repo.countByStatus("pending");
  }

  async countByStatus(status: SourceOfFundsStatus): Promise<number> {
    return this.repo.countByStatus(status);
  }

  async listByStatus(
    status: SourceOfFundsStatus,
    limit = 50,
    offset = 0,
  ): Promise<SourceOfFundsCase[]> {
    return this.repo.listByStatus(status, limit, offset);
  }

  async triage(command: SourceOfFundsTriageCommand): Promise<SourceOfFundsCase> {
    const run = async (conn?: Database): Promise<SourceOfFundsCase> => {
      const existing = await this.repo.findById(command.caseId, conn);
      if (!existing) throw new Error("source_of_funds_not_found");
      if (existing.userId === command.analystUserId) {
        throw new Error("source_of_funds_triage_self_forbidden");
      }
      if (existing.status !== "pending") {
        throw new Error("source_of_funds_not_pending");
      }
      if (existing.triageRecommendation) {
        throw new Error("source_of_funds_triage_already_set");
      }
      const recommendation =
        command.recommendation === "approve" ? "recommend_approve" : "recommend_reject";
      const updated = await this.repo.setTriage(
        {
          id: command.caseId,
          recommendation,
          triagedByUserId: command.analystUserId,
          triageNotes: command.notes,
        },
        conn,
      );
      if (!updated) throw new Error("source_of_funds_triage_already_set");
      return updated;
    };

    if (this.transactionRunner) return this.transactionRunner.runInTransaction((tx) => run(tx));
    return run();
  }

  async decide(command: SourceOfFundsDecideCommand): Promise<SourceOfFundsCase> {
    const run = async (conn?: Database): Promise<SourceOfFundsCase> => {
      const existing = await this.repo.findById(command.caseId, conn);
      if (!existing) throw new Error("source_of_funds_not_found");
      if (existing.userId === command.reviewerUserId) {
        throw new Error("source_of_funds_review_self_forbidden");
      }
      if (existing.status !== "pending") {
        throw new Error("source_of_funds_not_pending");
      }
      if (!existing.triagedByUserId || !existing.triageRecommendation) {
        throw new Error("source_of_funds_triage_required");
      }
      if (existing.triagedByUserId === command.reviewerUserId) {
        throw new Error("source_of_funds_review_same_as_triager");
      }
      const status = command.decision === "approve" ? "approved" : "rejected";
      const updated = await this.repo.setReview(
        {
          id: command.caseId,
          status,
          reviewedByUserId: command.reviewerUserId,
          reviewNotes: command.notes,
        },
        conn,
      );
      if (!updated) throw new Error("source_of_funds_not_pending");

      if (conn && this.events) {
        await this.events.publish(conn, {
          aggregateType: "source_of_funds",
          aggregateId: updated.id,
          eventType: SOURCE_OF_FUNDS_REVIEWED_EVENT,
          actorUserId: command.reviewerUserId,
          payload: {
            sourceOfFundsId: updated.id,
            userId: updated.userId,
            status: updated.status,
            trigger: updated.trigger,
          },
        });
      }
      return updated;
    };

    if (this.transactionRunner) return this.transactionRunner.runInTransaction((tx) => run(tx));
    return run();
  }

  async reopenRejected(command: {
    caseId: string;
    actorUserId: string;
  }): Promise<SourceOfFundsCase> {
    const run = async (conn?: Database): Promise<SourceOfFundsCase> => {
      const existing = await this.repo.findById(command.caseId, conn);
      if (!existing) throw new Error("source_of_funds_not_found");
      if (existing.status !== "rejected") {
        throw new Error("source_of_funds_not_rejected");
      }
      const updated = await this.repo.reopenRejected(command.caseId, conn);
      if (!updated) throw new Error("source_of_funds_reopen_failed");
      await this.repo.resetDocumentCycle(command.caseId, conn);

      if (conn && this.events) {
        await this.events.publish(conn, {
          aggregateType: "source_of_funds",
          aggregateId: updated.id,
          eventType: SOURCE_OF_FUNDS_REQUIRED_EVENT,
          actorUserId: command.actorUserId,
          payload: {
            sourceOfFundsId: updated.id,
            userId: updated.userId,
            trigger: updated.trigger,
            thresholdAmount: updated.thresholdAmount,
            exposureAmount: updated.exposureAmount,
            currency: updated.currency,
            reopened: true,
          },
        });
      }
      return updated;
    };

    if (this.transactionRunner) return this.transactionRunner.runInTransaction((tx) => run(tx));
    return run();
  }
}
