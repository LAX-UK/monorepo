import type { DomainEventConnection, DomainEventInput } from "@auction/persistence";
import type { DomainEventPublisher } from "./domain-event.publisher.js";

/**
 * Connection-owning event port (DIP). Services publish domain events without
 * holding a `Database`: the root connection is captured once in the container;
 * transactional call sites rebind with {@link IDomainEventSink.withTx}.
 */
export interface IDomainEventSink {
  publish(event: DomainEventInput): Promise<void>;
  /** Sink bound to a transaction so events commit/roll back with the tx. */
  withTx(tx: DomainEventConnection): IDomainEventSink;
}

export class DomainEventSink implements IDomainEventSink {
  constructor(
    private readonly publisher: DomainEventPublisher,
    private readonly conn: DomainEventConnection,
  ) {}

  publish(event: DomainEventInput): Promise<void> {
    return this.publisher.publish(this.conn, event);
  }

  withTx(tx: DomainEventConnection): IDomainEventSink {
    return new DomainEventSink(this.publisher, tx);
  }
}
