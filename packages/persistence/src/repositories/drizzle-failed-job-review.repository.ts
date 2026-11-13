import type { Database } from "@auction/db";
import { failedJobs } from "@auction/db/schema";
import { type SQL, and, asc, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type {
  FailedJobFilter,
  FailedJobNeedsReviewGroup,
  FailedJobRecord,
  FailedJobRecordWithPayload,
  FailedJobReviewView,
  FailedJobSearch,
  FailedJobSearchResult,
  IFailedJobDisposition,
  IFailedJobNeedsReviewGroups,
  IFailedJobReviewReader,
} from "../interfaces/failed-job-review.js";
import { firstErrorLine } from "../lib/first-error-line.js";
import { containsPattern } from "../lib/like-pattern.js";
import { INTEGRATION_DISPOSITION_QUEUE } from "./drizzle-integration-dead-letter.repository.js";

const LONDON_DAY = sql`((${failedJobs.failedAt} AT TIME ZONE 'Europe/London')::date)`;

/** Decisions on integration deliveries live in the same table; they have their own reader. */
const BACKGROUND_JOBS_ONLY = ne(failedJobs.originalQueue, INTEGRATION_DISPOSITION_QUEUE);

/** Each view as a predicate; one table, so a new view is one more row. */
const VIEW_PREDICATES: Readonly<Record<FailedJobReviewView, SQL>> = {
  needs_review: and(
    BACKGROUND_JOBS_ONLY,
    isNull(failedJobs.discardedAt),
    isNull(failedJobs.replayedAt),
  ) as SQL,
  retried: and(
    BACKGROUND_JOBS_ONLY,
    isNull(failedJobs.discardedAt),
    isNotNull(failedJobs.replayedAt),
  ) as SQL,
  discarded: and(BACKGROUND_JOBS_ONLY, isNotNull(failedJobs.discardedAt)) as SQL,
};

const VIEWS = Object.keys(VIEW_PREDICATES) as FailedJobReviewView[];

const LIST_COLUMNS = {
  id: failedJobs.id,
  originalQueue: failedJobs.originalQueue,
  originalJobId: failedJobs.originalJobId,
  originalJobName: failedJobs.originalJobName,
  errorMessage: failedJobs.errorMessage,
  attempts: failedJobs.attempts,
  firstFailedAt: failedJobs.firstFailedAt,
  failedAt: failedJobs.failedAt,
  replayedAt: failedJobs.replayedAt,
  replayedBy: failedJobs.replayedBy,
  discardedAt: failedJobs.discardedAt,
  discardedBy: failedJobs.discardedBy,
  discardReason: failedJobs.discardReason,
  discardNote: failedJobs.discardNote,
} as const;

function filterConditions(input: FailedJobFilter, options: { ignoreQueue?: boolean } = {}): SQL[] {
  const conditions: SQL[] = [];
  if (input.queue && !options.ignoreQueue)
    conditions.push(eq(failedJobs.originalQueue, input.queue));
  if (input.fromDay) conditions.push(sql`${LONDON_DAY} >= ${input.fromDay}::date`);
  if (input.toDay) conditions.push(sql`${LONDON_DAY} <= ${input.toDay}::date`);
  if (input.q) {
    const pattern = containsPattern(input.q);
    conditions.push(
      sql`(${failedJobs.id} ILIKE ${pattern} OR ${failedJobs.originalQueue} ILIKE ${pattern}
        OR ${failedJobs.originalJobName} ILIKE ${pattern} OR ${failedJobs.originalJobId} ILIKE ${pattern}
        OR ${failedJobs.errorMessage} ILIKE ${pattern})`,
    );
  }
  return conditions;
}

export class DrizzleFailedJobReviewRepository
  implements IFailedJobReviewReader, IFailedJobDisposition, IFailedJobNeedsReviewGroups
{
  constructor(private readonly db: Database) {}

  async search(input: FailedJobSearch): Promise<FailedJobSearchResult> {
    const filters = filterConditions(input);
    const inView = and(VIEW_PREDICATES[input.view], ...filters);
    const order =
      input.sort === "failed_asc" ? asc(failedJobs.failedAt) : desc(failedJobs.failedAt);

    const [rows, viewCounts, queueCounts] = await Promise.all([
      this.db
        .select(LIST_COLUMNS)
        .from(failedJobs)
        .where(inView)
        .orderBy(order, asc(failedJobs.id))
        .limit(input.limit)
        .offset(input.offset),
      // The view tabs count under every filter except the view itself.
      Promise.all(
        VIEWS.map(async (view) => {
          const [row] = await this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(failedJobs)
            .where(and(VIEW_PREDICATES[view], ...filters));
          return [view, row?.count ?? 0] as const;
        }),
      ),
      this.db
        .select({ queue: failedJobs.originalQueue, count: sql<number>`count(*)::int` })
        .from(failedJobs)
        .where(and(VIEW_PREDICATES[input.view], ...filterConditions(input, { ignoreQueue: true })))
        .groupBy(failedJobs.originalQueue)
        .orderBy(asc(failedJobs.originalQueue)),
    ]);

    const counts = Object.fromEntries(viewCounts) as Record<FailedJobReviewView, number>;
    return { rows, total: counts[input.view], counts, queues: queueCounts };
  }

  async needsReviewGroups(since: Date): Promise<FailedJobNeedsReviewGroup[]> {
    const errorLine = firstErrorLine(sql`${failedJobs.errorMessage}`);
    return this.db
      .select({
        jobType: failedJobs.originalQueue,
        jobName: failedJobs.originalJobName,
        errorLine,
        count: sql<number>`count(*)::int`,
        newSince: sql<number>`(count(*) FILTER (WHERE ${failedJobs.firstFailedAt} >= ${since.toISOString()}::timestamptz))::int`,
        firstFailedAt: sql<Date>`min(${failedJobs.firstFailedAt})`.mapWith(
          failedJobs.firstFailedAt,
        ),
        lastFailedAt: sql<Date>`max(${failedJobs.failedAt})`.mapWith(failedJobs.failedAt),
      })
      .from(failedJobs)
      .where(VIEW_PREDICATES.needs_review)
      .groupBy(failedJobs.originalQueue, failedJobs.originalJobName, errorLine);
  }

  async findForReview(id: string): Promise<FailedJobRecordWithPayload | null> {
    const [row] = await this.db
      .select({ ...LIST_COLUMNS, payloadJson: failedJobs.payloadJson })
      .from(failedJobs)
      .where(eq(failedJobs.id, id))
      .limit(1);
    return row ?? null;
  }

  async findManyForReview(ids: readonly string[]): Promise<FailedJobRecord[]> {
    if (ids.length === 0) return [];
    return this.db
      .select(LIST_COLUMNS)
      .from(failedJobs)
      .where(inArray(failedJobs.id, [...ids]));
  }

  async discard(input: {
    ids: readonly string[];
    byUserId: string;
    reason: string;
    note: string | null;
  }): Promise<string[]> {
    if (input.ids.length === 0) return [];
    const changed = await this.db
      .update(failedJobs)
      .set({
        discardedAt: new Date(),
        discardedBy: input.byUserId,
        discardReason: input.reason,
        discardNote: input.note,
      })
      .where(and(inArray(failedJobs.id, [...input.ids]), VIEW_PREDICATES.needs_review))
      .returning({ id: failedJobs.id });
    return changed.map((row) => row.id);
  }

  async restore(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const changed = await this.db
      .update(failedJobs)
      .set({ discardedAt: null, discardedBy: null, discardReason: null, discardNote: null })
      .where(and(inArray(failedJobs.id, [...ids]), isNotNull(failedJobs.discardedAt)))
      .returning({ id: failedJobs.id });
    return changed.map((row) => row.id);
  }
}
