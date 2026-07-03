import type { Database } from "@auction/db";
import { domainEvent, sale } from "@auction/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { ILotLifecycleTimelineReader } from "./interfaces/lot-lifecycle-timeline.reader.js";

export class DrizzleLotLifecycleTimelineReader implements ILotLifecycleTimelineReader {
  constructor(private readonly db: Database) {}

  async fetchTimelineEvents(lotId: string, limit: number, offset: number) {
    const rows = await this.db
      .select({
        id: domainEvent.id,
        eventType: domainEvent.eventType,
        payload: domainEvent.payload,
        actorUserId: domainEvent.actorUserId,
        occurredAt: domainEvent.occurredAt,
      })
      .from(domainEvent)
      .where(and(eq(domainEvent.aggregateType, "lot"), eq(domainEvent.aggregateId, lotId)))
      .orderBy(desc(domainEvent.occurredAt), desc(domainEvent.id))
      .offset(offset)
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      payload: r.payload as Record<string, unknown>,
      actorUserId: r.actorUserId,
      occurredAt: r.occurredAt,
    }));
  }

  async fetchSaleTitlesByIds(saleIds: readonly string[]) {
    const uniqueIds = [...new Set(saleIds)];
    if (uniqueIds.length === 0) return new Map<string, string>();

    const saleRows = await this.db
      .select({ id: sale.id, title: sale.title })
      .from(sale)
      .where(inArray(sale.id, uniqueIds));

    return new Map(saleRows.map((s) => [s.id, s.title]));
  }
}
