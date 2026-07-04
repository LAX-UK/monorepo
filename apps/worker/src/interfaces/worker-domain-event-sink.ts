import type { DomainEventConnection, DomainEventInput } from "@auction/persistence/lib";

export interface IWorkerDomainEventSink {
  publish(event: DomainEventInput): Promise<void>;
  withTx(tx: DomainEventConnection): IWorkerDomainEventSink;
}
