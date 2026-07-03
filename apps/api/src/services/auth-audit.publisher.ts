import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IAuthAuditPublisher } from "./interfaces/auth-audit-publisher.js";

/** Emits `auth.*` rows into `domain_events` (same pipeline as money-path events). */
export class AuthAuditPublisher implements IAuthAuditPublisher {
  constructor(private readonly domainEventSink: IDomainEventSink) {}

  async publish(input: {
    eventType: string;
    aggregateId: string;
    aggregateType?: string;
    payload: Record<string, unknown>;
    actorUserId?: string | null;
  }): Promise<void> {
    await this.domainEventSink.publish({
      aggregateType: input.aggregateType ?? "user",
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload,
      producer: "apps/api",
      actorUserId: input.actorUserId ?? null,
    });
  }
}
