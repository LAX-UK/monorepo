import type { Database } from "@auction/db";
import { adminReviewTask, sourceOfFunds, sourceOfFundsDocumentReview } from "@auction/db";
import { and, eq, sql } from "drizzle-orm";
import type pino from "pino";
import type {
  ISourceOfFundsDocumentReviewRepository,
  ISourceOfFundsReviewResolutionRepository,
  SourceOfFundsDocumentReviewUpsert,
} from "../interfaces/source-of-funds-review-projector.repository.js";

export class DrizzleSourceOfFundsDocumentReviewRepository
  implements ISourceOfFundsDocumentReviewRepository
{
  constructor(private readonly db: Database) {}

  async upsertReview(input: SourceOfFundsDocumentReviewUpsert): Promise<void> {
    await this.db
      .insert(sourceOfFundsDocumentReview)
      .values({
        documentId: input.documentId,
        sourceOfFundsId: input.sourceOfFundsId,
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: input.reviewedAt,
        checks: input.checks,
        note: input.note,
      })
      .onConflictDoUpdate({
        target: sourceOfFundsDocumentReview.documentId,
        set: {
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: input.reviewedAt,
          checks: input.checks,
          note: input.note,
        },
      });
  }
}

export class DrizzleSourceOfFundsReviewResolutionRepository
  implements ISourceOfFundsReviewResolutionRepository
{
  constructor(private readonly db: Database) {}

  async resolveIfTerminal(
    sourceOfFundsId: string,
    actorUserId: string | null,
    log: pino.Logger,
  ): Promise<void> {
    const [caseRow] = await this.db
      .select({ status: sourceOfFunds.status })
      .from(sourceOfFunds)
      .where(eq(sourceOfFunds.id, sourceOfFundsId))
      .limit(1);
    const caseStatus = caseRow?.status ?? null;
    const caseIsTerminal = caseStatus === "approved" || caseStatus === "rejected";

    if (!caseIsTerminal) {
      log.info(
        { sourceOfFundsId, caseStatus },
        "source_of_funds_review_resolution_skipped_non_terminal",
      );
      return;
    }

    const existing = await this.db
      .select({ id: adminReviewTask.id, status: adminReviewTask.status })
      .from(adminReviewTask)
      .where(
        and(
          eq(adminReviewTask.kind, "source_of_funds_review"),
          sql`${adminReviewTask.payload} ->> 'sourceOfFundsId' = ${sourceOfFundsId}`,
        ),
      )
      .limit(1);

    const task = existing[0];
    if (task && (task.status === "pending" || task.status === "in_progress")) {
      await this.db
        .update(adminReviewTask)
        .set({
          status: "resolved",
          resolvedAt: new Date(),
          resolvedByUserId: actorUserId ?? null,
        })
        .where(eq(adminReviewTask.id, task.id));
      log.info({ sourceOfFundsId, taskId: task.id }, "source_of_funds_review_task_resolved");
    } else if (!task) {
      log.warn({ sourceOfFundsId }, "source_of_funds_review_task_not_found_for_resolution");
    }
  }
}
