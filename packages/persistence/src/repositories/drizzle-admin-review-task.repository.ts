import type { Database } from "@auction/db";
import { adminReviewTask } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { IAdminReviewTaskRepository } from "../interfaces/admin-review-task.repository.js";

export class DrizzleAdminReviewTaskRepository implements IAdminReviewTaskRepository {
  constructor(private readonly db: Database) {}

  forConnection(conn: Database): IAdminReviewTaskRepository {
    return new DrizzleAdminReviewTaskRepository(conn);
  }

  async findPendingLotWithdrawal(lotId: string): Promise<{ id: string } | null> {
    const [row] = await this.db
      .select({ id: adminReviewTask.id })
      .from(adminReviewTask)
      .where(
        and(
          eq(adminReviewTask.targetLotId, lotId),
          eq(adminReviewTask.kind, "lot_withdrawal_request"),
          eq(adminReviewTask.status, "pending"),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async createLotWithdrawalRequest(input: {
    lotId: string;
    requestedByUserId: string;
  }): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(adminReviewTask)
      .values({
        kind: "lot_withdrawal_request",
        status: "pending",
        targetLotId: input.lotId,
        payload: { requestedByUserId: input.requestedByUserId },
      })
      .returning({ id: adminReviewTask.id });
    if (!row) throw new Error("admin_review_task_insert_failed");
    return row;
  }

  async resolveLotWithdrawal(input: {
    taskId: string;
    resolvedByUserId: string;
    resolutionNotes: string;
  }): Promise<void> {
    await this.db
      .update(adminReviewTask)
      .set({
        status: "resolved",
        resolvedByUserId: input.resolvedByUserId,
        resolvedAt: new Date(),
        resolutionNotes: input.resolutionNotes,
      })
      .where(eq(adminReviewTask.id, input.taskId));
  }
}
