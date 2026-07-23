import type { Database } from "@auction/db";
import { itemSubmission, submissionCategories } from "@auction/db/schema";
import { and, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type {
  AdminSubmissionsListSummary,
  IAdminSubmissionsSummaryReader,
} from "../interfaces/admin-submissions-summary.reader.js";

const AWAITING = ["submitted", "under_review"] as const;
const ACCEPTED = ["approved", "converted"] as const;
const OVER_SLA_DAYS = 7;

function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function qualityGapsSql() {
  return sql`(
    btrim(${itemSubmission.title}) = '' OR
    NOT EXISTS (
      SELECT 1 FROM ${submissionCategories}
      WHERE ${submissionCategories.submissionId} = ${itemSubmission.id}
    ) OR
    cardinality(${itemSubmission.images}) < 1 OR
    cardinality(${itemSubmission.images}) < 3 OR
    ${itemSubmission.description} IS NULL OR btrim(${itemSubmission.description}) = '' OR
    jsonb_array_length(${itemSubmission.provenance}) = 0
  )`;
}

export class DrizzleAdminSubmissionsSummaryReader implements IAdminSubmissionsSummaryReader {
  constructor(private readonly db: Database) {}

  async getSummaryForStaff(userId: string): Promise<AdminSubmissionsListSummary> {
    const now = new Date();
    const dayStart = startOfUtcDay(now);
    const overSlaCutoff = new Date(now.getTime() - OVER_SLA_DAYS * 24 * 60 * 60 * 1000);

    const countWhere = async (...parts: Parameters<typeof and>) => {
      const where = and(...parts);
      const q = this.db.select({ n: count() }).from(itemSubmission);
      const [row] = where ? await q.where(where) : await q;
      return Number(row?.n ?? 0);
    };

    const [
      awaitingReview,
      assignedToMe,
      overSla,
      rejectedToday,
      qualityGaps,
      reviewedToday,
      queueAwaiting,
      queueAccepted,
      queueRejected,
      avgQueueAgeRow,
    ] = await Promise.all([
      countWhere(inArray(itemSubmission.status, [...AWAITING])),
      countWhere(
        inArray(itemSubmission.status, [...AWAITING]),
        eq(itemSubmission.assignedToUserId, userId),
      ),
      countWhere(
        inArray(itemSubmission.status, [...AWAITING]),
        lt(itemSubmission.updatedAt, overSlaCutoff),
      ),
      countWhere(eq(itemSubmission.status, "rejected"), gte(itemSubmission.reviewedAt, dayStart)),
      countWhere(inArray(itemSubmission.status, [...AWAITING]), qualityGapsSql()),
      countWhere(
        inArray(itemSubmission.status, ["approved", "converted", "rejected"]),
        gte(itemSubmission.reviewedAt, dayStart),
      ),
      countWhere(inArray(itemSubmission.status, [...AWAITING])),
      countWhere(inArray(itemSubmission.status, [...ACCEPTED])),
      countWhere(eq(itemSubmission.status, "rejected")),
      this.db
        .select({
          avgDays: sql<number | null>`avg(
            extract(epoch from (now() - ${itemSubmission.createdAt})) / 86400
          )`,
        })
        .from(itemSubmission)
        .where(inArray(itemSubmission.status, [...AWAITING]))
        .then(([row]) => row?.avgDays ?? null),
    ]);

    const avgQueueAgeDays =
      avgQueueAgeRow != null && Number.isFinite(avgQueueAgeRow)
        ? Math.round(avgQueueAgeRow * 10) / 10
        : null;

    return {
      awaitingReview,
      assignedToMe,
      overSla,
      rejectedToday,
      qualityGaps,
      reviewedToday,
      avgQueueAgeDays,
      queueCounts: {
        awaiting: queueAwaiting,
        accepted: queueAccepted,
        rejected: queueRejected,
      },
    };
  }
}
