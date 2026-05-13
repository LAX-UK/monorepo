import type { Database } from "@auction/db";
import type { DomainEventPublisher } from "./domain-event.publisher.js";

/** Emits `auth.*` rows into `domain_events` (same pipeline as money-path events). */
export class AuthAuditPublisher {
  constructor(private readonly inner: DomainEventPublisher) {}

  async publish(
    db: Database,
    input: {
      eventType: string;
      aggregateId: string;
      aggregateType?: string;
      payload: Record<string, unknown>;
      actorUserId?: string | null;
    },
  ): Promise<void> {
    await this.inner.publish(db, {
      aggregateType: input.aggregateType ?? "user",
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload,
      producer: "apps/api",
      actorUserId: input.actorUserId ?? null,
    });
  }
}
