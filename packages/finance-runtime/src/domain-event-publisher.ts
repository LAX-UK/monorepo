import type { DomainEventPublishInput } from "./domain-event-sink-port.js";

/** Fire-and-forget domain events outside an explicit transaction scope. */
export interface IDomainEventPublisher {
  publish(event: DomainEventPublishInput): Promise<void>;
}
