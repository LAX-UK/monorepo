import type { Database } from "@auction/db";
import { domainEvent, projectorState } from "@auction/db";
import { and, gt, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type {
  DomainEventProjectorRow,
  IDomainEventProjectorReader,
  ListDomainEventsAfterCursorOptions,
} from "../interfaces/domain-event-projector.reader.js";
import { rowsFromExecuteResult } from "../projectors/lib/projector-event-rows.js";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";

export class DrizzleDomainEventProjectorReader implements IDomainEventProjectorReader {
  constructor(private readonly db: Database) {}

  async listAfterCursor(
    cursor: number,
    options?: ListDomainEventsAfterCursorOptions,
  ): Promise<DomainEventProjectorRow[]> {
    const limit = options?.limit ?? 100;
    const eventTypes = options?.eventTypes;
    const base = this.db
      .select({
        id: domainEvent.id,
        eventType: domainEvent.eventType,
        aggregateId: domainEvent.aggregateId,
        payload: domainEvent.payload,
        actorUserId: domainEvent.actorUserId,
      })
      .from(domainEvent)
      .where(
        eventTypes && eventTypes.length > 0
          ? and(gt(domainEvent.id, cursor), inArray(domainEvent.eventType, [...eventTypes]))
          : gt(domainEvent.id, cursor),
      )
      .orderBy(domainEvent.id)
      .limit(limit);
    return base;
  }

  async listLockedForProjector(
    projectorName: string,
    limit: number,
    conn: ProjectorDbConnection,
  ): Promise<DomainEventProjectorRow[]> {
    const rows = await conn.execute(sql`
      select id, event_type, aggregate_id, payload, actor_user_id
      from ${domainEvent}
      where id > (select last_processed_event_id from ${projectorState} where projector_name = ${projectorName})
      order by id
      limit ${limit}
      for update skip locked
    `);
    const events = rowsFromExecuteResult(rows) as Array<{
      id: number | string;
      event_type: string;
      aggregate_id: string;
      payload: unknown;
      actor_user_id?: string | null;
    }>;
    return events.map((event) => ({
      id: Number(event.id),
      eventType: event.event_type,
      aggregateId: event.aggregate_id,
      payload: event.payload,
      actorUserId: event.actor_user_id ?? null,
    }));
  }
}
