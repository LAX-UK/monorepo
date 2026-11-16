import { DEMO_SEED_EVENT_PRODUCER } from "@auction/domain";
import * as schema from "../../../schema/index.js";
import type { Db } from "../demo-topup-seed.js";

/** A domain event as the real service publishes it, recorded by the demo seed. */
export type SeedEvent = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  actingLegalEntityId?: string | null;
  occurredAt: Date;
};

/**
 * Writes the events the real service would have written, unchanged, with the demo seed's producer:
 * the explicit mark that keeps projectors from emailing anyone about invented data.
 */
export async function writeSeedEvents(db: Db, events: readonly SeedEvent[]): Promise<void> {
  if (events.length === 0) return;
  await db.insert(schema.domainEvent).values(
    events.map((event) => ({
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      producer: DEMO_SEED_EVENT_PRODUCER,
      actorUserId: event.actorUserId,
      actingLegalEntityId: event.actingLegalEntityId ?? null,
      occurredAt: event.occurredAt,
    })),
  );
}
