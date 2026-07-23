import { domainEvent } from "@auction/db/schema";
import type { IDomainEventPublisher } from "@auction/persistence/lib";
import type { DomainEventPublishValidateMode } from "@auction/types";
import { guardDomainEventPublish } from "@auction/types";

export type WorkerDomainEventPublisherOptions = {
  publishValidateMode?: DomainEventPublishValidateMode;
  onPublishContractViolation?: (detail: { eventType: string; error: string }) => void;
};

export class WorkerDomainEventPublisher implements IDomainEventPublisher {
  constructor(private readonly options: WorkerDomainEventPublisherOptions = {}) {}

  async publish(
    conn: Parameters<IDomainEventPublisher["publish"]>[0],
    event: Parameters<IDomainEventPublisher["publish"]>[1],
  ): Promise<void> {
    guardDomainEventPublish(
      this.options.publishValidateMode ?? "off",
      {
        eventType: event.eventType,
        payload: event.payload,
        ...(event.schemaVersion !== undefined ? { schemaVersion: event.schemaVersion } : {}),
      },
      this.options.onPublishContractViolation,
    );

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
