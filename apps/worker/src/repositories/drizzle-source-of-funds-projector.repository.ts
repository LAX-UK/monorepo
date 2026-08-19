import type { Database } from "@auction/db";
import { adminReviewTask, bidUserProfile, sourceOfFunds, user } from "@auction/db";
import { and, eq, sql } from "drizzle-orm";
import type {
  ISourceOfFundsBuyerReader,
  ISourceOfFundsDocumentsTaskRepository,
  ISourceOfFundsSettlementReader,
} from "../interfaces/source-of-funds-projector.repository.js";

export class DrizzleSourceOfFundsSettlementReader implements ISourceOfFundsSettlementReader {
  constructor(private readonly db: Database) {}

  async loadSettlementContext(userId: string): Promise<{ summary: string | null }> {
    const [row] = await this.db
      .select({ exposureAmount: sourceOfFunds.exposureAmount, currency: sourceOfFunds.currency })
      .from(sourceOfFunds)
      .where(and(eq(sourceOfFunds.userId, userId), eq(sourceOfFunds.status, "pending")))
      .orderBy(sql`${sourceOfFunds.createdAt} DESC`)
      .limit(1);
    if (!row) return { summary: null };
    return { summary: `${row.currency} ${row.exposureAmount} exposure under review` };
  }

  async getCaseStatus(sourceOfFundsId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ status: sourceOfFunds.status })
      .from(sourceOfFunds)
      .where(eq(sourceOfFunds.id, sourceOfFundsId))
      .limit(1);
    return row?.status ?? null;
  }
}

export class DrizzleSourceOfFundsBuyerReader implements ISourceOfFundsBuyerReader {
  constructor(private readonly db: Database) {}

  async getBuyerContact(userId: string) {
    const [row] = await this.db
      .select({
        email: user.email,
        firstName: sql<string | null>`coalesce(${bidUserProfile.firstName}, ${user.name})`,
      })
      .from(user)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    return row ?? null;
  }
}

export class DrizzleSourceOfFundsDocumentsTaskRepository
  implements ISourceOfFundsDocumentsTaskRepository
{
  constructor(private readonly db: Database) {}

  async reopenResolvedReviewTask(sourceOfFundsId: string): Promise<void> {
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
    if (task && task.status === "resolved") {
      await this.db
        .update(adminReviewTask)
        .set({ status: "pending", resolvedAt: null, resolvedByUserId: null })
        .where(eq(adminReviewTask.id, task.id));
    }
  }
}
