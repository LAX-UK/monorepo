import type { Database } from "@auction/db";
import { failedJobs, webhookEvent } from "@auction/db/schema";
import { and, asc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type {
  FailedWebhookRow,
  IIntegrationDeadLetterDisposition,
  IIntegrationDeadLetterReader,
  IWebhookRetryQueue,
  IntegrationDeadLetterRecord,
  IntegrationDeadLetterWithPayload,
  IntegrationDispositionSeed,
  IntegrationNameFilter,
  IntegrationSearch,
  IntegrationSearchResult,
  IntegrationView,
} from "../interfaces/integration-dead-letter.reader.js";

/** Marks a decision row as belonging to an integration delivery, not to a background job. */
export const INTEGRATION_DISPOSITION_QUEUE = "integrations";

const VIEWS: readonly IntegrationView[] = ["needs_review", "retried", "discarded"];

/** Each view as a predicate over `i` (the failing delivery) and `f` (its recorded decision). */
const VIEW_PREDICATES: Readonly<Record<IntegrationView, SQL>> = {
  needs_review: sql`(f.discarded_at IS NULL AND i.failing)`,
  retried: sql`(f.discarded_at IS NULL AND NOT i.failing AND f.replayed_at IS NOT NULL)`,
  discarded: sql`(f.discarded_at IS NOT NULL)`,
};

const LONDON_DAY = sql`((i.failed_at AT TIME ZONE 'Europe/London')::date)`;

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function nameCondition(column: SQL, filter: IntegrationNameFilter | null): SQL | null {
  if (filter === null) return null;
  if (filter.names.length === 0) return filter.mode === "in" ? sql`FALSE` : null;
  const list = sql.join(
    filter.names.map((name) => sql`${name}`),
    sql`, `,
  );
  return filter.mode === "in" ? sql`${column} IN (${list})` : sql`${column} NOT IN (${list})`;
}

/** What the caller may see: deliveries by consumer, webhooks by sender. */
function scopeCondition(scope: IntegrationSearch["scope"]): SQL {
  const delivery = nameCondition(sql`i.name`, scope.deliveries);
  const webhook = nameCondition(sql`i.name`, scope.webhooks);
  return sql`((i.kind = 'delivery'${delivery ? sql` AND ${delivery}` : sql``}) OR (i.kind = 'webhook'${webhook ? sql` AND ${webhook}` : sql``}))`;
}

function filterConditions(input: IntegrationSearch, options: { ignoreQueue?: boolean }): SQL[] {
  const conditions: SQL[] = [scopeCondition(input.scope)];
  if (input.queue && !options.ignoreQueue) {
    const [kind, ...rest] = input.queue.split(":");
    conditions.push(sql`(i.kind = ${kind ?? ""} AND i.name = ${rest.join(":")})`);
  }
  if (input.fromDay) conditions.push(sql`${LONDON_DAY} >= ${input.fromDay}::date`);
  if (input.toDay) conditions.push(sql`${LONDON_DAY} <= ${input.toDay}::date`);
  if (input.q) {
    const pattern = `%${escapeLike(input.q)}%`;
    conditions.push(
      sql`(i.id ILIKE ${pattern} OR i.name ILIKE ${pattern} OR i.event_type ILIKE ${pattern}
        OR i.event_key ILIKE ${pattern} OR i.error_message ILIKE ${pattern})`,
    );
  }
  return conditions;
}

/**
 * Failed deliveries and webhooks as one set. Only rows that are failing now, or that someone has
 * already decided on, are read, so the scan stays small however many deliveries succeed.
 */
const ITEMS = sql`
  SELECT 'delivery'::text AS kind, d.consumer AS name,
         ('delivery:' || d.id::text) AS id, e.event_type AS event_type, NULL::text AS event_key,
         d.last_error AS error_message, d.attempts AS attempts,
         d.created_at AS first_failed_at, d.updated_at AS failed_at,
         (d.status = 'dead_lettered') AS failing, NULL::jsonb AS payload_webhook,
         e.payload AS payload_event
  FROM domain_event_delivery d
  LEFT JOIN domain_events e ON e.id = d.event_id
  WHERE d.status = 'dead_lettered'
     OR EXISTS (SELECT 1 FROM failed_jobs x WHERE x.id = 'delivery:' || d.id::text)
  UNION ALL
  SELECT 'webhook'::text, w.source, ('webhook:' || w.id::text),
         COALESCE(w.payload->>'type', w.payload->'routing'->>'eventType'), w.event_key,
         w.last_error, w.attempts, w.received_at, w.received_at,
         (w.processed_at IS NULL AND w.last_error IS NOT NULL AND w.last_error <> ''),
         w.payload, NULL::jsonb
  FROM webhook_event w
  WHERE (w.processed_at IS NULL AND w.last_error IS NOT NULL AND w.last_error <> '')
     OR EXISTS (SELECT 1 FROM failed_jobs x WHERE x.id = 'webhook:' || w.id::text)
`;

const COLUMNS = sql`
  i.id, i.kind, i.name, i.event_type AS "eventType", i.event_key AS "eventKey",
  i.error_message AS "errorMessage", i.attempts, i.first_failed_at AS "firstFailedAt",
  i.failed_at AS "failedAt", i.failing,
  f.replayed_at AS "replayedAt", f.replayed_by AS "replayedBy",
  f.discarded_at AS "discardedAt", f.discarded_by AS "discardedBy",
  f.discard_reason AS "discardReason", f.discard_note AS "discardNote"
`;

type Row = Record<string, unknown>;

function rowsOf(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  const rows = (result as { rows?: Row[] } | null)?.rows;
  return rows ?? [];
}

const asDate = (value: unknown): Date => (value instanceof Date ? value : new Date(String(value)));
const asDateOrNull = (value: unknown): Date | null => (value == null ? null : asDate(value));
const asStringOrNull = (value: unknown): string | null => (value == null ? null : String(value));

function toRecord(row: Row): IntegrationDeadLetterRecord {
  return {
    id: String(row.id),
    kind: row.kind === "webhook" ? "webhook" : "delivery",
    name: String(row.name),
    eventType: asStringOrNull(row.eventType),
    eventKey: asStringOrNull(row.eventKey),
    errorMessage: asStringOrNull(row.errorMessage),
    attempts: Number(row.attempts ?? 0),
    firstFailedAt: asDate(row.firstFailedAt),
    failedAt: asDate(row.failedAt),
    failing: row.failing === true,
    replayedAt: asDateOrNull(row.replayedAt),
    replayedBy: asStringOrNull(row.replayedBy),
    discardedAt: asDateOrNull(row.discardedAt),
    discardedBy: asStringOrNull(row.discardedBy),
    discardReason: asStringOrNull(row.discardReason),
    discardNote: asStringOrNull(row.discardNote),
  };
}

function seedValues(seed: IntegrationDispositionSeed) {
  return {
    id: seed.id,
    originalQueue: INTEGRATION_DISPOSITION_QUEUE,
    attempts: seed.attempts,
    firstFailedAt: seed.firstFailedAt,
    failedAt: seed.failedAt,
  };
}

/**
 * Reads failed integration deliveries and webhooks, and records what staff decide about them in
 * the failed-jobs table under the delivery's prefixed id, so one store holds every decision.
 */
export class DrizzleIntegrationDeadLetterRepository
  implements IIntegrationDeadLetterReader, IIntegrationDeadLetterDisposition, IWebhookRetryQueue
{
  constructor(private readonly db: Database) {}

  async listFailedWebhooks(input: { limit: number; offset: number }): Promise<FailedWebhookRow[]> {
    return this.db
      .select({
        id: webhookEvent.id,
        source: webhookEvent.source,
        eventKey: webhookEvent.eventKey,
        attempts: webhookEvent.attempts,
        lastError: webhookEvent.lastError,
        receivedAt: webhookEvent.receivedAt,
      })
      .from(webhookEvent)
      .where(
        and(
          isNull(webhookEvent.processedAt),
          isNotNull(webhookEvent.lastError),
          ne(webhookEvent.lastError, ""),
        ),
      )
      .orderBy(asc(webhookEvent.receivedAt))
      .limit(input.limit)
      .offset(input.offset);
  }

  async search(input: IntegrationSearch): Promise<IntegrationSearchResult> {
    const filters = filterConditions(input, {});
    const where = (view: IntegrationView, list: readonly SQL[]) =>
      sql`${VIEW_PREDICATES[view]} AND ${sql.join([...list], sql` AND `)}`;
    const base = sql`WITH i AS (${ITEMS})`;
    const joined = sql`FROM i LEFT JOIN failed_jobs f ON f.id = i.id`;
    const order =
      input.sort === "failed_asc"
        ? sql`i.failed_at ASC, i.id ASC`
        : sql`i.failed_at DESC, i.id ASC`;

    const [rows, counts, queues] = await Promise.all([
      this.db.execute(sql`${base} SELECT ${COLUMNS} ${joined}
        WHERE ${where(input.view, filters)} ORDER BY ${order}
        LIMIT ${input.limit} OFFSET ${input.offset}`),
      this.db.execute(sql`${base} SELECT
          count(*) FILTER (WHERE ${where("needs_review", filters)})::int AS needs_review,
          count(*) FILTER (WHERE ${where("retried", filters)})::int AS retried,
          count(*) FILTER (WHERE ${where("discarded", filters)})::int AS discarded
        ${joined}`),
      this.db.execute(sql`${base} SELECT i.kind, i.name, count(*)::int AS count ${joined}
        WHERE ${where(input.view, filterConditions(input, { ignoreQueue: true }))}
        GROUP BY i.kind, i.name ORDER BY i.kind, i.name`),
    ]);

    const countRow = rowsOf(counts)[0] ?? {};
    const byView = Object.fromEntries(
      VIEWS.map((view) => [view, Number(countRow[view] ?? 0)]),
    ) as Record<IntegrationView, number>;
    return {
      rows: rowsOf(rows).map(toRecord),
      total: byView[input.view],
      counts: byView,
      queues: rowsOf(queues).map((row) => ({
        kind: row.kind === "webhook" ? "webhook" : "delivery",
        name: String(row.name),
        count: Number(row.count),
      })),
    };
  }

  async findForReview(id: string): Promise<IntegrationDeadLetterWithPayload | null> {
    const result = await this.db.execute(sql`WITH i AS (${ITEMS})
      SELECT ${COLUMNS}, COALESCE(i.payload_event, i.payload_webhook) AS payload
      FROM i LEFT JOIN failed_jobs f ON f.id = i.id WHERE i.id = ${id}`);
    const row = rowsOf(result)[0];
    return row ? { ...toRecord(row), payload: row.payload ?? null } : null;
  }

  async findManyForReview(ids: readonly string[]): Promise<IntegrationDeadLetterRecord[]> {
    if (ids.length === 0) return [];
    const list = sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    );
    const result = await this.db.execute(sql`WITH i AS (${ITEMS})
      SELECT ${COLUMNS} FROM i LEFT JOIN failed_jobs f ON f.id = i.id WHERE i.id IN (${list})`);
    return rowsOf(result).map(toRecord);
  }

  async claimRetry(seed: IntegrationDispositionSeed, byUserId: string): Promise<boolean> {
    const now = new Date();
    const claimed = await this.db
      .insert(failedJobs)
      .values({ ...seedValues(seed), replayedAt: now, replayedBy: byUserId })
      .onConflictDoUpdate({
        target: failedJobs.id,
        set: { replayedAt: now, replayedBy: byUserId, failedAt: seed.failedAt },
        // Not discarded, and not already retried since it last failed.
        setWhere: sql`${failedJobs.discardedAt} IS NULL
          AND (${failedJobs.replayedAt} IS NULL OR ${failedJobs.replayedAt} < ${seed.failedAt})`,
      })
      .returning({ id: failedJobs.id });
    return claimed.length > 0;
  }

  async releaseRetry(id: string): Promise<void> {
    await this.db
      .update(failedJobs)
      .set({ replayedAt: null, replayedBy: null })
      .where(eq(failedJobs.id, id));
  }

  async discard(input: {
    seeds: readonly IntegrationDispositionSeed[];
    byUserId: string;
    reason: string;
    note: string | null;
  }): Promise<string[]> {
    const changed: string[] = [];
    const now = new Date();
    for (const seed of input.seeds) {
      const rows = await this.db
        .insert(failedJobs)
        .values({
          ...seedValues(seed),
          discardedAt: now,
          discardedBy: input.byUserId,
          discardReason: input.reason,
          discardNote: input.note,
        })
        .onConflictDoUpdate({
          target: failedJobs.id,
          set: {
            discardedAt: now,
            discardedBy: input.byUserId,
            discardReason: input.reason,
            discardNote: input.note,
          },
          setWhere: isNull(failedJobs.discardedAt),
        })
        .returning({ id: failedJobs.id });
      changed.push(...rows.map((row) => row.id));
    }
    return changed;
  }

  async restore(ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .update(failedJobs)
      .set({ discardedAt: null, discardedBy: null, discardReason: null, discardNote: null })
      .where(and(inArray(failedJobs.id, [...ids]), isNotNull(failedJobs.discardedAt)))
      .returning({ id: failedJobs.id });
    return rows.map((row) => row.id);
  }

  async requeue(eventKey: string): Promise<void> {
    await this.db
      .update(webhookEvent)
      .set({ lastError: null, processedAt: null })
      .where(and(eq(webhookEvent.eventKey, eventKey), isNull(webhookEvent.processedAt)));
  }
}
