import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile, domainEvent } from "@auction/db/schema";
import { redactDomainEventPayload } from "@auction/types";
import { and, asc, desc, eq, ilike, like, or, sql } from "drizzle-orm";
import type { IAdminDomainEventReader } from "../interfaces/admin-domain-event.reader.js";
import type {
  AuditActorRecord,
  AuditLogRecord,
  AuditLogSearchInput,
  AuditLogSearchResult,
  RedactedDomainEventRow,
} from "../interfaces/admin-read-models.js";
import { buildAuditLogWhere, escapeLikePattern } from "./audit-log-sql.js";

const DOMAIN_EVENT_LIST_COLUMNS = {
  id: domainEvent.id,
  aggregateType: domainEvent.aggregateType,
  aggregateId: domainEvent.aggregateId,
  eventType: domainEvent.eventType,
  payload: domainEvent.payload,
  actorUserId: domainEvent.actorUserId,
  actingLegalEntityId: domainEvent.actingLegalEntityId,
  occurredAt: domainEvent.occurredAt,
};

function redactRows(
  rows: Array<{
    id: number;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: unknown;
    actorUserId: string | null;
    actingLegalEntityId: string | null;
    occurredAt: Date;
  }>,
  includePii: boolean,
): RedactedDomainEventRow[] {
  return rows.map((r) => ({
    ...r,
    payload: redactDomainEventPayload(r.eventType, r.payload, { includePii }),
  }));
}

export class DrizzleAdminDomainEventReader implements IAdminDomainEventReader {
  constructor(private readonly db: Database) {}

  async listRedacted(input: {
    limit: number;
    offset?: number;
    eventTypePrefix?: string;
    aggregateType?: string;
    aggregateId?: string;
    includePii: boolean;
  }): Promise<RedactedDomainEventRow[]> {
    const offset = Math.max(0, input.offset ?? 0);
    const prefix = input.eventTypePrefix?.trim();
    const aggType = input.aggregateType?.trim();
    const aggId = input.aggregateId?.trim();
    if (aggType && aggId) {
      const rows = await this.db
        .select(DOMAIN_EVENT_LIST_COLUMNS)
        .from(domainEvent)
        .where(and(eq(domainEvent.aggregateType, aggType), eq(domainEvent.aggregateId, aggId)))
        .orderBy(asc(domainEvent.occurredAt), asc(domainEvent.id))
        .offset(offset)
        .limit(input.limit);
      return redactRows(rows, input.includePii);
    }
    let q = this.db.select(DOMAIN_EVENT_LIST_COLUMNS).from(domainEvent);
    if (prefix) {
      q = q.where(like(domainEvent.eventType, `${prefix}%`)) as typeof q;
    }
    const rows = await q.orderBy(desc(domainEvent.id)).offset(offset).limit(input.limit);
    return redactRows(rows, input.includePii);
  }

  async countForExport(input: {
    aggregateType?: string;
    aggregateId?: string;
  }): Promise<number> {
    const aggType = input.aggregateType?.trim();
    const aggId = input.aggregateId?.trim();
    if (aggType && aggId) {
      const [row] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(domainEvent)
        .where(and(eq(domainEvent.aggregateType, aggType), eq(domainEvent.aggregateId, aggId)));
      return row?.n ?? 0;
    }
    const [row] = await this.db.select({ n: sql<number>`count(*)::int` }).from(domainEvent);
    return row?.n ?? 0;
  }

  async searchAuditLog(input: AuditLogSearchInput): Promise<AuditLogSearchResult> {
    const where = buildAuditLogWhere(input);

    const countQuery = this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(domainEvent)
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, domainEvent.actorUserId))
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, domainEvent.actorUserId));
    const [countRow] = where ? await countQuery.where(where) : await countQuery;

    const rowsQuery = this.db
      .select({
        ...DOMAIN_EVENT_LIST_COLUMNS,
        actorName: bidIdentityDirectory.name,
        actorEmail: bidIdentityDirectory.email,
        actorRole: bidUserProfile.role,
      })
      .from(domainEvent)
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, domainEvent.actorUserId))
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, domainEvent.actorUserId))
      .orderBy(
        ...(input.sort === "at_asc"
          ? [asc(domainEvent.occurredAt), asc(domainEvent.id)]
          : [desc(domainEvent.occurredAt), desc(domainEvent.id)]),
      )
      .limit(input.limit)
      .offset(input.offset);
    const rows = where ? await rowsQuery.where(where) : await rowsQuery;

    return {
      total: countRow?.n ?? 0,
      rows: rows.map(
        ({ actorRole, ...row }): AuditLogRecord => ({
          ...row,
          actorName: row.actorName ?? null,
          actorEmail: row.actorEmail ?? null,
          actorIsStaff: actorRole === "staff",
        }),
      ),
    };
  }

  async searchAuditActors(input: {
    q?: string;
    limit: number;
    staffOnly: boolean;
  }): Promise<AuditActorRecord[]> {
    const text = input.q?.trim();
    const contains = text ? `%${escapeLikePattern(text)}%` : null;
    const clauses = [
      sql`exists (select 1 from ${domainEvent} where ${domainEvent.actorUserId} = ${bidIdentityDirectory.subjectId})`,
      input.staffOnly ? eq(bidUserProfile.role, "staff") : undefined,
      contains
        ? or(
            ilike(bidIdentityDirectory.name, contains),
            ilike(bidIdentityDirectory.email, contains),
          )
        : undefined,
    ];
    const rows = await this.db
      .select({
        userId: bidIdentityDirectory.subjectId,
        name: bidIdentityDirectory.name,
        email: bidIdentityDirectory.email,
        role: bidUserProfile.role,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(and(...clauses))
      .orderBy(asc(bidIdentityDirectory.name), asc(bidIdentityDirectory.email))
      .limit(input.limit);
    return rows.map((row) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      isStaff: row.role === "staff",
    }));
  }
}
