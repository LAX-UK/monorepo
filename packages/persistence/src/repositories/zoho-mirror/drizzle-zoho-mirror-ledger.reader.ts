import type { Database } from "@auction/db";
import { domainEventDelivery as delivery, domainEvent } from "@auction/db/schema";
import {
  ARTWORK_WRITEBACK_EVENT,
  ORDER_MIRROR_EVENT_TYPES,
  ZOHO_MIRROR_CONSUMER,
} from "@auction/types";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type {
  IZohoMirrorLedgerReader,
  ZohoMirrorLedger,
  ZohoMirrorLedgerDelivery,
  ZohoMirrorLedgerEntity,
} from "../../interfaces/zoho-mirror-ledger.js";

/**
 * A record's events. An order's are raised on the order, a line or the fulfilment and all carry
 * `orderId` in the payload; an artwork's are raised on its register entry.
 *
 * Each is held to the event types its consumer handles, so Postgres reaches the rows through
 * `domain_events_event_type_idx` (orders) or `domain_events_event_type_aggregate_id_idx`
 * (artworks) instead of reading every event LAX has ever raised. The plan is in PR #1516.
 */
const KEY = {
  order: {
    key: sql<string>`${domainEvent.payload}->>'orderId'`,
    scope: inArray(domainEvent.eventType, [...ORDER_MIRROR_EVENT_TYPES]),
  },
  artwork: {
    key: sql<string>`${domainEvent.aggregateId}`,
    scope: and(
      inArray(domainEvent.eventType, Object.values(ARTWORK_WRITEBACK_EVENT)),
      eq(domainEvent.aggregateType, "artwork_register"),
    ),
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
        eventType: domainEvent.eventType,
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
