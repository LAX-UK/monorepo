import type { DomainEventConnection, DomainEventInput } from "@auction/persistence/lib";
import type { IDomainEventPublisher } from "@auction/persistence/lib";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";

export class WorkerDomainEventSink implements IWorkerDomainEventSink {
  constructor(
    private readonly publisher: IDomainEventPublisher,
    private readonly conn: DomainEventConnection,
  ) {}

  publish(event: DomainEventInput): Promise<void> {
    return this.publisher.publish(this.conn, event);
  }

  withTx(tx: DomainEventConnection): IWorkerDomainEventSink {
    return new WorkerDomainEventSink(this.publisher, tx);
  }
}
