import type { Database } from "@auction/db";
import { domainEvent, lotLifecycleSnapshot, sale } from "@auction/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

export type LotLifecycleSnapshotRow = typeof lotLifecycleSnapshot.$inferSelect;

export type LotLifecycleTimelineEvent = {
  id: number;
  eventType: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  occurredAt: Date;
  saleTitle?: string | null;
};

export class LotLifecycleQueryService {
  constructor(private readonly db: Database) {}

  async getSnapshot(lotId: string): Promise<LotLifecycleSnapshotRow | null> {
    const [row] = await this.db
      .select()
      .from(lotLifecycleSnapshot)
      .where(eq(lotLifecycleSnapshot.lotId, lotId))
      .limit(1);
    return row ?? null;
  }

  async getSnapshotsForLots(lotIds: string[]): Promise<Map<string, LotLifecycleSnapshotRow>> {
    if (lotIds.length === 0) return new Map();
    const rows = await this.db
      .select()
      .from(lotLifecycleSnapshot)
      .where(inArray(lotLifecycleSnapshot.lotId, lotIds));
    return new Map(rows.map((r) => [r.lotId, r]));
  }

  async timeline(
    lotId: string,
    opts: { limit?: number; offset?: number; includeSaleContext?: boolean } = {},
  ): Promise<LotLifecycleTimelineEvent[]> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

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

    const chronological = [...rows].reverse();

    if (!opts.includeSaleContext) {
      return chronological.map((r) => ({
        id: r.id,
        eventType: r.eventType,
        payload: r.payload as Record<string, unknown>,
        actorUserId: r.actorUserId,
        occurredAt: r.occurredAt,
      }));
    }

    const saleIds = new Set<string>();
    for (const row of chronological) {
      const payload = row.payload as Record<string, unknown>;
      if (typeof payload.saleId === "string") saleIds.add(payload.saleId);
      if (typeof payload.lastSaleId === "string") saleIds.add(payload.lastSaleId);
      if (typeof payload.fromSaleId === "string") saleIds.add(payload.fromSaleId);
    }

    const saleTitles = new Map<string, string>();
    if (saleIds.size > 0) {
      const saleRows = await this.db
        .select({ id: sale.id, title: sale.title })
        .from(sale)
        .where(inArray(sale.id, [...saleIds]));
      for (const s of saleRows) saleTitles.set(s.id, s.title);
    }

    return chronological.map((r) => {
      const payload = r.payload as Record<string, unknown>;
      const sid =
        (typeof payload.saleId === "string" ? payload.saleId : null) ??
        (typeof payload.lastSaleId === "string" ? payload.lastSaleId : null) ??
        (typeof payload.fromSaleId === "string" ? payload.fromSaleId : null);
      return {
        id: r.id,
        eventType: r.eventType,
        payload,
        actorUserId: r.actorUserId,
        occurredAt: r.occurredAt,
        saleTitle: sid ? (saleTitles.get(sid) ?? null) : null,
      };
    });
  }
}
