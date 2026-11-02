import {
  DATA_REQUEST_DUE_SOON_DAYS,
  DATA_REQUEST_PRODUCTS,
  type DataRequestProduct,
  type DataRequestSummary,
  downloadReference,
} from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import {
  subjectDataExport,
  subjectDataExportAudit,
  subjectDataRequest,
  subjectDataRequestAudit,
  user,
} from "@auction/identity-db/schema";
import { type SQL, asc, eq, inArray, sql } from "drizzle-orm";
import { NO_DUE_DATE_KEY } from "../services/data-request.cursor.js";
import type {
  AccountFacts,
  AuditTimelineRow,
  DataRequestReader,
  MergedListFilter,
  MergedRequestRow,
  RecordSource,
} from "../services/data-request.ports.js";
import { toManualRequestRow } from "./drizzle-data-request.mapper.js";
import { toSubjectExportRow } from "./drizzle-subject-export.repository.js";

type MergedDbRow = Record<string, unknown> & { source_id: string };

/**
 * Both kinds of request as one relation, classified once. A download is open while the copy is
 * being prepared or failed and has not been taken over; Ready, Expired and Deleted by person count
 * as met. A manual request is open until it is closed, including while it waits for ID. Dates are
 * London calendar days as text, so they compare in date order.
 */
const MERGED = sql`(
  SELECT
    'download'::text AS kind,
    e."id"::text AS source_id,
    'DL-' || upper(left(e."id"::text, 6)) AS reference,
    e."subject_id" AS subject_id,
    u."email" AS email,
    NULL::text AS contact_detail,
    e."status" AS status,
    NULL::text AS reason,
    NULL::text AS channel,
    ARRAY['account','bid','shop']::text[] AS products,
    (SELECT count(*) FROM jsonb_each_text(e."product_progress") p WHERE p.value = 'done')::int AS products_done,
    to_char(e."requested_at" AT TIME ZONE 'Europe/London', 'YYYY-MM-DD') AS requested_on,
    to_char(e."due_at" AT TIME ZONE 'Europe/London', 'YYYY-MM-DD') AS due_on,
    false AS extended,
    NULL::text AS outcome,
    CASE WHEN e."status" IN ('ready','expired','deleted') AND e."ready_at" IS NOT NULL
      THEN to_char(e."ready_at" AT TIME ZONE 'Europe/London', 'YYYY-MM-DD') END AS answered_on,
    m."reference" AS continued_as,
    (e."status" IN ('requested','collecting','delayed','failed') AND m."id" IS NULL) AS is_open,
    (e."status" IN ('ready','expired','deleted')) AS is_closed
  FROM "subject_data_export" e
  LEFT JOIN "user" u ON u."id" = e."subject_id"
  LEFT JOIN "subject_data_request" m ON m."linked_export_id" = e."id"
  UNION ALL
  SELECT
    'manual'::text,
    r."id"::text,
    r."reference",
    r."subject_id",
    u."email",
    r."contact_detail",
    r."status",
    r."reason",
    r."channel",
    r."products",
    (SELECT count(*) FROM unnest(r."products") p WHERE jsonb_exists(r."product_gathered", p))::int,
    to_char(r."received_on", 'YYYY-MM-DD'),
    to_char(coalesce(r."extended_due_on", r."due_on"), 'YYYY-MM-DD'),
    r."extended_due_on" IS NOT NULL,
    r."outcome",
    CASE WHEN r."outcome" IS NOT NULL AND r."outcome" <> 'withdrawn'
      THEN to_char(r."closed_on", 'YYYY-MM-DD') END,
    NULL::text,
    (r."status" <> 'closed'),
    (r."status" = 'closed')
  FROM "subject_data_request" r
  LEFT JOIN "user" u ON u."id" = r."subject_id"
) merged`;

function viewCondition(filter: MergedListFilter): SQL | null {
  switch (filter.view) {
    case "open":
      return sql`is_open`;
    case "overdue":
      return sql`is_open AND due_on < ${filter.today}`;
    case "waiting":
      return sql`status = 'waiting_for_id'`;
    case "closed":
      return sql`is_closed`;
    case "all":
      return null;
  }
}

function kindCondition(kind: string): SQL {
  return kind === "download" || kind === "manual" ? sql`kind = ${kind}` : sql`reason = ${kind}`;
}

/** A reference, or a full email address; never part of either. */
function searchCondition(q: string): SQL {
  return q.includes("@")
    ? sql`(lower(email) = lower(${q}) OR lower(contact_detail) = lower(${q}))`
    : sql`reference = upper(${q})`;
}

function conditions(filter: MergedListFilter): SQL[] {
  const all: Array<SQL | null> = [
    viewCondition(filter),
    filter.status ? sql`status = ${filter.status}` : null,
    filter.kind ? kindCondition(filter.kind) : null,
    filter.product ? sql`${filter.product} = ANY(products)` : null,
    filter.q ? searchCondition(filter.q) : null,
  ];
  if (filter.after) {
    const { key, reference } = filter.after;
    all.push(
      filter.sort === "due"
        ? sql`(coalesce(due_on, ${NO_DUE_DATE_KEY}), reference) > (${key}::text, ${reference}::text)`
        : sql`(requested_on, reference) < (${key}::text, ${reference}::text)`,
    );
  }
  return all.filter((condition): condition is SQL => condition !== null);
}

function toMergedRow(row: MergedDbRow): MergedRequestRow {
  return {
    kind: row.kind as MergedRequestRow["kind"],
    reference: String(row.reference),
    subjectId: (row.subject_id as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    contactDetail: (row.contact_detail as string | null) ?? null,
    status: String(row.status),
    reason: (row.reason as MergedRequestRow["reason"]) ?? null,
    channel: (row.channel as MergedRequestRow["channel"]) ?? null,
    products: row.products as DataRequestProduct[],
    productsDone: Number(row.products_done),
    requestedOn: String(row.requested_on),
    dueOn: (row.due_on as string | null) ?? null,
    extended: Boolean(row.extended),
    outcome: (row.outcome as MergedRequestRow["outcome"]) ?? null,
    answeredOn: (row.answered_on as string | null) ?? null,
    continuedAs: (row.continued_as as string | null) ?? null,
    open: Boolean(row.is_open),
  };
}

/** Events that are the person's own action; the rest are the system's or staff's. */
const PERSON_EVENTS = new Set([
  "data_export.requested",
  "data_export.downloaded",
  "data_export.deleted_by_subject",
]);

function accountStatus(row: {
  deletionRequestedAt: Date | null;
  identityDisabledAt: Date | null;
}): string {
  if (row.deletionRequestedAt) return "Deletion requested";
  if (row.identityDisabledAt) return "Disabled";
  return "Active";
}

/** Read model for the merged list, the summary and the record page. It cannot change a request. */
export class DrizzleDataRequestReader implements DataRequestReader {
  constructor(private readonly db: IdentityDatabase) {}

  async list(filter: MergedListFilter): Promise<MergedRequestRow[]> {
    const where = conditions(filter);
    const order =
      filter.sort === "due"
        ? sql`ORDER BY coalesce(due_on, ${NO_DUE_DATE_KEY}) ASC, reference ASC`
        : sql`ORDER BY requested_on DESC, reference DESC`;
    const result = await this.db.execute(sql`
      SELECT * FROM ${MERGED}
      ${where.length > 0 ? sql`WHERE ${sql.join(where, sql` AND `)}` : sql``}
      ${order}
      LIMIT ${filter.limit}
    `);
    return (result.rows as MergedDbRow[]).map(toMergedRow);
  }

  async summary(today: string): Promise<DataRequestSummary> {
    const result = await this.db.execute(sql`
      SELECT
        count(*) FILTER (WHERE is_open)::int AS open_count,
        count(*) FILTER (
          WHERE is_open AND due_on >= ${today}
            AND due_on::date <= ${today}::date + ${DATA_REQUEST_DUE_SOON_DAYS}::int
        )::int AS due_soon,
        count(*) FILTER (WHERE is_open AND due_on < ${today})::int AS overdue,
        count(*) FILTER (WHERE status = 'waiting_for_id')::int AS waiting,
        count(*) FILTER (
          WHERE answered_on IS NOT NULL
            AND answered_on::date >= (${today}::date - interval '12 months')::date
        )::int AS answered,
        count(*) FILTER (
          WHERE answered_on IS NOT NULL AND due_on IS NOT NULL AND answered_on <= due_on
            AND answered_on::date >= (${today}::date - interval '12 months')::date
        )::int AS on_time
      FROM ${MERGED}
    `);
    const row = (result.rows[0] ?? {}) as Record<string, number>;
    return {
      open: Number(row.open_count ?? 0),
      dueSoon: Number(row.due_soon ?? 0),
      overdue: Number(row.overdue ?? 0),
      waitingForId: Number(row.waiting ?? 0),
      answeredLast12Months: {
        answered: Number(row.answered ?? 0),
        onTime: Number(row.on_time ?? 0),
      },
    };
  }

  async accountExists(subjectId: string): Promise<boolean> {
    const [found] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, subjectId))
      .limit(1);
    return found !== undefined;
  }

  async findRecord(reference: string): Promise<RecordSource | null | "ambiguous_reference"> {
    const result = await this.db.execute(sql`
      SELECT * FROM ${MERGED} WHERE reference = ${reference} LIMIT 2
    `);
    const rows = result.rows as MergedDbRow[];
    const [first] = rows;
    if (!first) return null;
    if (rows.length > 1) return "ambiguous_reference";
    const summary = toMergedRow(first);

    const manualRow =
      summary.kind === "manual"
        ? ((
            await this.db
              .select()
              .from(subjectDataRequest)
              .where(eq(subjectDataRequest.id, first.source_id))
          )[0] ?? null)
        : null;
    const manual = manualRow ? toManualRequestRow(manualRow) : null;
    const downloadId =
      manual?.linkedExportId ?? (summary.kind === "download" ? first.source_id : null);
    const downloadRow = downloadId
      ? ((
          await this.db.select().from(subjectDataExport).where(eq(subjectDataExport.id, downloadId))
        )[0] ?? null)
      : null;
    const download =
      summary.kind === "download" && downloadRow ? toSubjectExportRow(downloadRow) : null;

    const [account, timeline, collectedRecords] = await Promise.all([
      this.accountFacts(summary.subjectId),
      this.timeline(manual?.id ?? null, downloadId),
      this.collectedRecords(summary.kind === "download" ? downloadId : null),
    ]);
    const actorNames = await this.names([
      ...timeline.flatMap((row) => (row.actorSubjectId ? [row.actorSubjectId] : [])),
      ...Object.values(manual?.productGathered ?? {}).map((gathered) => gathered.by),
    ]);

    return {
      summary,
      manual,
      download,
      continuedFrom: manual && downloadRow ? downloadReference(downloadRow.id) : null,
      account,
      timeline,
      actorNames,
      collectedRecords,
    };
  }

  private async accountFacts(subjectId: string | null): Promise<AccountFacts | null> {
    if (subjectId === null) return null;
    const [row] = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        deletionRequestedAt: user.deletionRequestedAt,
        identityDisabledAt: user.identityDisabledAt,
      })
      .from(user)
      .where(eq(user.id, subjectId));
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      joinedOn: row.createdAt.toISOString().slice(0, 10),
      status: accountStatus(row),
    };
  }

  /** Both audit trails in time order. IP addresses are never read; the user agent becomes a device label upstream. */
  private async timeline(
    manualId: string | null,
    downloadId: string | null,
  ): Promise<AuditTimelineRow[]> {
    const rows: AuditTimelineRow[] = [];
    if (downloadId) {
      const audit = await this.db
        .select()
        .from(subjectDataExportAudit)
        .where(eq(subjectDataExportAudit.exportId, downloadId))
        .orderBy(asc(subjectDataExportAudit.occurredAt), asc(subjectDataExportAudit.id));
      for (const row of audit) {
        const detail = (row.detail ?? {}) as Record<string, unknown>;
        const staff = row.event === "data_export.continued_manually" ? detail.actorSubjectId : null;
        rows.push({
          at: row.occurredAt,
          event: row.event,
          actorSubjectId:
            typeof staff === "string" ? staff : PERSON_EVENTS.has(row.event) ? row.subjectId : null,
          userAgent: row.userAgent,
          detail,
        });
      }
    }
    if (manualId) {
      const audit = await this.db
        .select()
        .from(subjectDataRequestAudit)
        .where(eq(subjectDataRequestAudit.requestId, manualId))
        .orderBy(asc(subjectDataRequestAudit.occurredAt), asc(subjectDataRequestAudit.id));
      for (const row of audit) {
        rows.push({
          at: row.occurredAt,
          event: row.event,
          actorSubjectId: row.actorSubjectId,
          userAgent: null,
          detail: (row.detail ?? {}) as Record<string, unknown>,
        });
      }
    }
    return rows.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  private async collectedRecords(
    downloadId: string | null,
  ): Promise<Partial<Record<DataRequestProduct, number>>> {
    if (!downloadId) return {};
    const audit = await this.db
      .select({ detail: subjectDataExportAudit.detail })
      .from(subjectDataExportAudit)
      .where(
        sql`${subjectDataExportAudit.exportId} = ${downloadId} AND ${subjectDataExportAudit.event} = 'data_export.product_collected'`,
      );
    const counts: Partial<Record<DataRequestProduct, number>> = {};
    for (const { detail } of audit) {
      const { product, records } = (detail ?? {}) as { product?: string; records?: number };
      if (
        (DATA_REQUEST_PRODUCTS as readonly string[]).includes(product ?? "") &&
        typeof records === "number"
      ) {
        counts[product as DataRequestProduct] = records;
      }
    }
    return counts;
  }

  private async names(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id) => id !== "system"))];
    if (unique.length === 0) return new Map();
    const rows = await this.db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, unique));
    return new Map(rows.map((row) => [row.id, row.name]));
  }
}
