import { domainEvent } from "@auction/db/schema";
import type {
  DomainEventConnection,
  DomainEventInput,
  IDomainEventPublisher,
} from "@auction/persistence/lib";
import type { DomainEventPublishValidateMode } from "@auction/types";
import { guardDomainEventPublish } from "@auction/types";

export type { DomainEventConnection, DomainEventInput } from "@auction/persistence/lib";

export type DomainEventPublisherOptions = {
  publishValidateMode?: DomainEventPublishValidateMode;
  onPublishContractViolation?: (detail: { eventType: string; error: string }) => void;
};

export class DomainEventPublisher implements IDomainEventPublisher {
  constructor(private readonly options: DomainEventPublisherOptions = {}) {}

  async publish(tx: DomainEventConnection, event: DomainEventInput): Promise<void> {
    guardDomainEventPublish(
      this.options.publishValidateMode ?? "off",
      {
        eventType: event.eventType,
        payload: event.payload,
        ...(event.schemaVersion !== undefined ? { schemaVersion: event.schemaVersion } : {}),
      },
      this.options.onPublishContractViolation,
    );

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
