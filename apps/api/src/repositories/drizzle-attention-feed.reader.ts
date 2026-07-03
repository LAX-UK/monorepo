import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { itemSubmission, lot, payment } from "@auction/db/schema";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { composeAttentionItems } from "../services/attention-feed.service.js";
import type { AttentionItem, IAttentionFeedReader } from "../services/interfaces/attention-feed.js";

export class DrizzleAttentionFeedReader implements IAttentionFeedReader {
  constructor(private readonly db: Database) {}

  async list(limit = 10): Promise<AttentionItem[]> {
    const now = new Date();

    const [submissions, stalePayments, staleDrafts] = await Promise.all([
      this.db
        .select({
          id: itemSubmission.id,
          title: itemSubmission.title,
          status: itemSubmission.status,
          createdAt: itemSubmission.updatedAt,
        })
        .from(itemSubmission)
        .where(inArray(itemSubmission.status, ["submitted", "under_review"]))
        .orderBy(desc(itemSubmission.updatedAt))
        .limit(limit),
      this.db
        .select({
          id: payment.id,
          status: payment.status,
          createdAt: payment.createdAt,
        })
        .from(payment)
        .where(inArray(payment.status, ["pending", "authorized"]))
        .orderBy(desc(payment.createdAt))
        .limit(limit),
      this.db
        .select({
          id: lot.id,
          title: lot.title,
          startTime: lot.startTime,
          createdAt: lot.updatedAt,
        })
        .from(lot)
        .where(and(eq(lot.status, "draft"), lt(lot.startTime, now), lotNotDeleted()))
        .orderBy(desc(lot.updatedAt))
        .limit(limit),
    ]);

    return composeAttentionItems({
      submissions,
      payments: stalePayments,
      draftLots: staleDrafts,
      now,
      limit,
    });
  }
}
