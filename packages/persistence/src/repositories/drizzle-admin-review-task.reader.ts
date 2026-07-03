import type { Database } from "@auction/db";
import { adminReviewTask } from "@auction/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import type { IAdminReviewTaskReader } from "../interfaces/admin-review-task.reader.js";

export class DrizzleAdminReviewTaskReader implements IAdminReviewTaskReader {
  constructor(private readonly db: Database) {}

  async listPendingAdminReviewTasks(kind: "lot_artist_backfill" | "lot_withdrawal_request") {
    const kindFilter =
      kind === "lot_artist_backfill" ? "lot_artist_backfill" : "lot_withdrawal_request";
    return this.db
      .select()
      .from(adminReviewTask)
      .where(and(eq(adminReviewTask.kind, kindFilter), eq(adminReviewTask.status, "pending")))
      .orderBy(desc(adminReviewTask.createdAt))
      .limit(200);
  }

  async countPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<number> {
    const kindFilter =
      kind === "lot_artist_backfill" ? "lot_artist_backfill" : "lot_withdrawal_request";
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(adminReviewTask)
      .where(and(eq(adminReviewTask.kind, kindFilter), eq(adminReviewTask.status, "pending")));
    return row?.n ?? 0;
  }
}
