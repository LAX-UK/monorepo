import type { Database } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import { redactDomainEventPayload } from "@auction/types";
import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import type {
  IExportDomainEventsQuery,
  RedactedDomainEventRow,
} from "../ports/export-domain-events.query.js";

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

export class DrizzleExportDomainEventsQuery implements IExportDomainEventsQuery {
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
}
