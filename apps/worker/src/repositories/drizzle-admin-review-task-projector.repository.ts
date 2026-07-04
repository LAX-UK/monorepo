import type { Database } from "@auction/db";
import { adminReviewTask } from "@auction/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type {
  AmlScreeningReviewPayload,
  IAdminReviewTaskProjectorRepository,
  SourceOfFundsReviewPayload,
} from "../interfaces/admin-review-task-projector.repository.js";

export class DrizzleAdminReviewTaskProjectorRepository
  implements IAdminReviewTaskProjectorRepository
{
  constructor(private readonly db: Database) {}

  async findAmlScreeningReview(screeningId: string): Promise<{ id: string } | null> {
    const [row] = await this.db
      .select({ id: adminReviewTask.id })
      .from(adminReviewTask)
      .where(
        and(
          eq(adminReviewTask.kind, "aml_screening_review"),
          sql`${adminReviewTask.payload} ->> 'screeningId' = ${screeningId}`,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async createAmlScreeningReview(payload: AmlScreeningReviewPayload): Promise<void> {
    await this.db.insert(adminReviewTask).values({
      kind: "aml_screening_review",
      status: "pending",
      targetLotId: null,
      payload: {
        screeningId: payload.screeningId,
        userId: payload.userId,
        providerSessionId: payload.providerSessionId,
        outcome: payload.outcome,
        matchStatus: payload.matchStatus,
        categories: payload.categories,
        reasons: payload.reasons,
      },
    });
  }

  async findSourceOfFundsReview(
    sourceOfFundsId: string,
  ): Promise<{ id: string; status: string } | null> {
    const [row] = await this.db
      .select({ id: adminReviewTask.id, status: adminReviewTask.status })
      .from(adminReviewTask)
      .where(
        and(
          eq(adminReviewTask.kind, "source_of_funds_review"),
          sql`${adminReviewTask.payload} ->> 'sourceOfFundsId' = ${sourceOfFundsId}`,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async reactivateSourceOfFundsReview(taskId: string): Promise<void> {
    await this.db
      .update(adminReviewTask)
      .set({ status: "pending", resolvedAt: null, resolvedByUserId: null })
      .where(eq(adminReviewTask.id, taskId));
  }

  async createSourceOfFundsReview(payload: SourceOfFundsReviewPayload): Promise<void> {
    await this.db.insert(adminReviewTask).values({
      kind: "source_of_funds_review",
      status: "pending",
      targetLotId: null,
      payload: {
        sourceOfFundsId: payload.sourceOfFundsId,
        userId: payload.userId,
        trigger: payload.trigger,
        thresholdAmount: payload.thresholdAmount,
        exposureAmount: payload.exposureAmount,
        currency: payload.currency,
      },
    });
  }
}
