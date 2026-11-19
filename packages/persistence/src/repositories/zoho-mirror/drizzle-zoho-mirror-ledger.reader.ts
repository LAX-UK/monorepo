import type { Database } from "@auction/db";
import {
  domainEventDelivery as delivery,
  domainEvent,
  artworkRegister as register,
  artworkRegisterEvent as registerEvent,
} from "@auction/db/schema";
import {
  ARTWORK_LISTING_EVENT,
  ARTWORK_WRITEBACK_EVENT,
  ORDER_MIRROR_EVENT_TYPES,
  ZOHO_ARTWORK_LISTING_CONSUMER,
  ZOHO_MIRROR_CONSUMER,
} from "@auction/types";
import { type SQL, and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
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

type Row = ZohoMirrorLedgerDelivery & { key: string };

/** Oldest event first; on one event, the record's own consumer before the listing. */
function byEvent(own: string) {
  return (a: ZohoMirrorLedgerDelivery, b: ZohoMirrorLedgerDelivery) =>
    a.eventId - b.eventId || Number(b.consumer === own) - Number(a.consumer === own);
}

/** Reads the delivery ledger for the Zoho mirror consumers, in one query for any number of records. */
export class DrizzleZohoMirrorLedgerReader implements IZohoMirrorLedgerReader {
  constructor(private readonly db: Database) {}

  async read(entity: ZohoMirrorLedgerEntity, ids: readonly string[]): Promise<ZohoMirrorLedger> {
    const consumer = ZOHO_MIRROR_CONSUMER[entity];
    const deliveries = new Map<string, ZohoMirrorLedgerDelivery[]>(ids.map((id) => [id, []]));
    if (ids.length === 0) return { consumer, deliveries };

    const { key, scope } = KEY[entity];
    const rows = await this.rows(consumer, key, and(scope, inArray(key, [...ids])));
    if (entity === "artwork") rows.push(...(await this.listingRows(ids)));

    for (const { key: id, ...row } of rows) deliveries.get(id)?.push(row);
    if (entity === "artwork") for (const list of deliveries.values()) list.sort(byEvent(consumer));
    return { consumer, deliveries };
  }

  private async rows(consumer: string, key: SQL<string>, where: SQL | undefined): Promise<Row[]> {
    return this.db
      .select({
        key,
        consumer: delivery.consumer,
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
      .where(and(eq(delivery.consumer, consumer), where))
      .orderBy(asc(delivery.eventId));
  }

  /**
   * The LAX listing's deliveries that are about these artworks: those of events raised on the
   * register entry, and those raised on the lax.art listing each is offered through or was drafted
   * into (the same two links the worker follows, `registerIdsForLaxArtListing`).
   */
  private async listingRows(registerIds: readonly string[]): Promise<Row[]> {
    const onRegister = await this.rows(
      ZOHO_ARTWORK_LISTING_CONSUMER,
      sql<string>`${domainEvent.aggregateId}`,
      and(
        eq(domainEvent.aggregateType, "artwork_register"),
        inArray(domainEvent.eventType, [...ARTWORK_LISTING_EVENT.onRegister]),
        inArray(domainEvent.aggregateId, [...registerIds]),
      ),
    );

    const registersOf = await this.laxArtListingsOf(registerIds);
    if (registersOf.size === 0) return onRegister;
    const onListing = await this.rows(
      ZOHO_ARTWORK_LISTING_CONSUMER,
      sql<string>`${domainEvent.aggregateId}`,
      and(
        eq(domainEvent.aggregateType, "shop_artwork"),
        inArray(domainEvent.eventType, [...ARTWORK_LISTING_EVENT.onLaxArtListing]),
        inArray(domainEvent.aggregateId, [...registersOf.keys()]),
      ),
    );
    return [
      ...onRegister,
      ...onListing.flatMap((row) =>
        [...(registersOf.get(row.key) ?? [])].map((registerId) => ({ ...row, key: registerId })),
      ),
    ];
  }

  /** Each lax.art listing (its artwork id) tied to these records, with the records it ties to. */
  private async laxArtListingsOf(
    registerIds: readonly string[],
  ): Promise<Map<string, Set<string>>> {
    const ids = [...registerIds];
    const [offered, drafted] = await Promise.all([
      this.db
        .select({ registerId: register.id, artworkId: register.offerRefId })
        .from(register)
        .where(
          and(
            inArray(register.id, ids),
            eq(register.offerRefKind, "shop_artwork"),
            isNotNull(register.offerRefId),
          ),
        ),
      this.db
        .select({
          registerId: registerEvent.registerId,
          artworkId: sql<string | null>`${registerEvent.payload}->>'artworkId'`,
        })
        .from(registerEvent)
        .where(
          and(
            inArray(registerEvent.registerId, ids),
            eq(registerEvent.type, "lax_art_draft_created"),
          ),
        ),
    ]);
    const registersOf = new Map<string, Set<string>>();
    for (const { registerId, artworkId } of [...offered, ...drafted]) {
      if (!artworkId) continue;
      const set = registersOf.get(artworkId) ?? new Set<string>();
      set.add(registerId);
      registersOf.set(artworkId, set);
    }
    return registersOf;
  }
}
