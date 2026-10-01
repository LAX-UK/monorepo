import type { Database } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import type { LiveDomainEventType } from "@auction/types";
import { guardDomainEventPublish } from "@auction/types";

export type ShopDomainEventInsert = {
  aggregateType: string;
  aggregateId: string;
  eventType: LiveDomainEventType;
  payload: Record<string, unknown> & { schemaVersion: 1 };
  producer: "shop-api";
};

export type ShopDomainEventPublisherMode = "off" | "observe" | "enforce";

export function createShopDomainEventPublisher(mode: ShopDomainEventPublisherMode): {
  insertInTransaction(tx: Database, event: ShopDomainEventInsert): Promise<void>;
} {
  return {
    async insertInTransaction(tx, event) {
      guardDomainEventPublish(mode, {
        eventType: event.eventType,
        payload: event.payload,
        schemaVersion: event.payload.schemaVersion,
      });
      await tx.insert(domainEvent).values({
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        schemaVersion: event.payload.schemaVersion,
        producer: event.producer,
      });
    },
  };
}
