import { domainEvent } from "@auction/db/schema";
import type { IDomainEventPublisher } from "@auction/persistence/lib";

export class WorkerDomainEventPublisher implements IDomainEventPublisher {
  async publish(
    conn: Parameters<IDomainEventPublisher["publish"]>[0],
    event: Parameters<IDomainEventPublisher["publish"]>[1],
  ): Promise<void> {
    await conn.insert(domainEvent).values({
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      producer: event.producer ?? "apps/worker",
      actorUserId: event.actorUserId ?? null,
      actingLegalEntityId: event.actingLegalEntityId ?? null,
      schemaVersion: event.schemaVersion ?? 1,
    });
  }
}
