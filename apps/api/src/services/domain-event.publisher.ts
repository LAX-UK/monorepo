import { domainEvent } from "@auction/db/schema";
import type {
  DomainEventConnection,
  DomainEventInput,
  IDomainEventPublisher,
} from "@auction/persistence";

export type { DomainEventConnection, DomainEventInput } from "@auction/persistence";

export class DomainEventPublisher implements IDomainEventPublisher {
  async publish(tx: DomainEventConnection, event: DomainEventInput): Promise<void> {
    await tx.insert(domainEvent).values({
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      producer: event.producer ?? "apps/api",
      actorUserId: event.actorUserId ?? null,
      actingLegalEntityId: event.actingLegalEntityId ?? null,
      schemaVersion: event.schemaVersion ?? 1,
    });
  }
}
