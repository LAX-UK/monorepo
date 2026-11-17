import type { Database } from "@auction/db";
import { domainEventDelivery as delivery, domainEvent } from "@auction/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type {
  IZohoMirrorLedgerReader,
  ZohoMirrorLedger,
  ZohoMirrorLedgerDelivery,
  ZohoMirrorLedgerEntity,
} from "../../interfaces/zoho-mirror-ledger.js";

/** The consumer that mirrors each kind of record. */
export const ZOHO_MIRROR_CONSUMER: Record<ZohoMirrorLedgerEntity, string> = {
  order: "zoho_fulfilment",
  artwork: "zoho_artwork_writeback",
};

/**
 * A record's events: an order's carry `orderId` in the payload (they are raised on the order, a
 * line or the fulfilment); an artwork's are raised on its register entry.
 */
const KEY = {
  order: { key: sql<string>`${domainEvent.payload}->>'orderId'`, scope: undefined },
  artwork: {
    key: sql<string>`${domainEvent.aggregateId}`,
    scope: eq(domainEvent.aggregateType, "artwork_register"),
  },
} as const;

/** Reads the delivery ledger for the Zoho mirror consumers, in one query for any number of records. */
export class DrizzleZohoMirrorLedgerReader implements IZohoMirrorLedgerReader {
  constructor(private readonly db: Database) {}

  async read(entity: ZohoMirrorLedgerEntity, ids: readonly string[]): Promise<ZohoMirrorLedger> {
    const consumer = ZOHO_MIRROR_CONSUMER[entity];
    const deliveries = new Map<string, ZohoMirrorLedgerDelivery[]>(ids.map((id) => [id, []]));
    if (ids.length === 0) return { consumer, deliveries };

    const { key, scope } = KEY[entity];
    const rows = await this.db
      .select({
        key,
        eventId: delivery.eventId,
        status: delivery.status,
        attempts: delivery.attempts,
        nextRetryAt: delivery.nextRetryAt,
        providerReference: delivery.providerReference,
        lastError: delivery.lastError,
        updatedAt: delivery.updatedAt,
      })
      .from(delivery)
      .innerJoin(domainEvent, eq(domainEvent.id, delivery.eventId))
      .where(and(eq(delivery.consumer, consumer), scope, inArray(key, [...ids])))
      .orderBy(asc(delivery.eventId));

    for (const { key: id, ...row } of rows) deliveries.get(id)?.push(row);
    return { consumer, deliveries };
  }
}
