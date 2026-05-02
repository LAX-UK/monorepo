import { domainEvent } from "@auction/db/schema";

export type DomainEventInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  producer?: string;
  actorUserId?: string | null;
  schemaVersion?: number;
};

export class DomainEventPublisher {
  async publish(
    tx: {
      insert: (table: typeof domainEvent) => {
        values: (value: typeof domainEvent.$inferInsert) => Promise<unknown>;
      };
    },
    event: DomainEventInput,
  ): Promise<void> {
    await tx.insert(domainEvent).values({
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      producer: event.producer ?? "apps/api",
      actorUserId: event.actorUserId ?? null,
      schemaVersion: event.schemaVersion ?? 1,
    });
  }
}
