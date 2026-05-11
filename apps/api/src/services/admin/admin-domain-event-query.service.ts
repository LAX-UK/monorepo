import type { Database } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import { redactDomainEventPayload } from "@auction/types";
import { desc, like } from "drizzle-orm";
import type {
  IAdminDomainEventQueryService,
  RedactedDomainEventRow,
} from "../interfaces/admin-routes.js";

export class AdminDomainEventQueryService implements IAdminDomainEventQueryService {
  constructor(private readonly db: Database) {}

  async listRedacted(input: {
    limit: number;
    eventTypePrefix?: string;
    includePii: boolean;
  }): Promise<RedactedDomainEventRow[]> {
    const prefix = input.eventTypePrefix?.trim();
    let q = this.db
      .select({
        id: domainEvent.id,
        aggregateType: domainEvent.aggregateType,
        aggregateId: domainEvent.aggregateId,
        eventType: domainEvent.eventType,
        payload: domainEvent.payload,
        actorUserId: domainEvent.actorUserId,
        actingLegalEntityId: domainEvent.actingLegalEntityId,
        occurredAt: domainEvent.occurredAt,
      })
      .from(domainEvent);
    if (prefix) {
      q = q.where(like(domainEvent.eventType, `${prefix}%`)) as typeof q;
    }
    const rows = await q.orderBy(desc(domainEvent.id)).limit(input.limit);
    return rows.map((r) => ({
      ...r,
      payload: redactDomainEventPayload(r.eventType, r.payload, { includePii: input.includePii }),
    }));
  }

  async listForExport(input: { includePii: boolean }): Promise<RedactedDomainEventRow[]> {
    const rows = await this.db
      .select({
        id: domainEvent.id,
        aggregateType: domainEvent.aggregateType,
        aggregateId: domainEvent.aggregateId,
        eventType: domainEvent.eventType,
        payload: domainEvent.payload,
        actorUserId: domainEvent.actorUserId,
        actingLegalEntityId: domainEvent.actingLegalEntityId,
        occurredAt: domainEvent.occurredAt,
      })
      .from(domainEvent)
      .orderBy(desc(domainEvent.id))
      .limit(5000);
    return rows.map((r) => ({
      ...r,
      payload: redactDomainEventPayload(r.eventType, r.payload, { includePii: input.includePii }),
    }));
  }

  formatExportCsv(rows: RedactedDomainEventRow[]): string {
    const esc = (v: string) => {
      if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const header =
      "id,aggregate_type,aggregate_id,event_type,actor_user_id,acting_legal_entity_id,occurred_at,payload_json\n";
    const body = rows
      .map((r) =>
        [
          String(r.id),
          esc(r.aggregateType),
          esc(r.aggregateId),
          esc(r.eventType),
          esc(r.actorUserId ?? ""),
          esc(r.actingLegalEntityId ?? ""),
          esc(r.occurredAt.toISOString()),
          esc(JSON.stringify(r.payload)),
        ].join(","),
      )
      .join("\n");
    return header + body;
  }
}
