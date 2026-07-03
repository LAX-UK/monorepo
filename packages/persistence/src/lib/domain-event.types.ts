import type { domainEvent } from "@auction/db/schema";

export type DomainEventInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  producer?: string;
  actorUserId?: string | null;
  /** Optional acting legal entity (matches `domain_events.acting_legal_entity_id`). */
  actingLegalEntityId?: string | null;
  schemaVersion?: number;
};

/** Any connection that can insert domain events (root pool or transaction). */
export type DomainEventConnection = {
  insert: (table: typeof domainEvent) => {
    values: (value: typeof domainEvent.$inferInsert) => Promise<unknown>;
  };
};

/** Port for publishing domain events without depending on api's concrete publisher. */
export interface IDomainEventPublisher {
  publish(conn: DomainEventConnection, event: DomainEventInput): Promise<void>;
}
