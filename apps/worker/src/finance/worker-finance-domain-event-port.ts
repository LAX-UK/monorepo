import type { IDomainEventSinkPort } from "@auction/finance-runtime";
import type { DomainEventConnection } from "@auction/persistence/lib";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";

/** Adapts worker domain event sink to finance-runtime transaction-scoped publish port. */
export function workerFinanceDomainEventSinkPort(
  sink: IWorkerDomainEventSink,
): IDomainEventSinkPort {
  return {
    withTx(tx: unknown) {
      const scoped = sink.withTx(tx as DomainEventConnection);
      return {
        publish: (event) =>
          scoped.publish({
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            eventType: event.eventType,
            payload: event.payload,
            actorUserId: event.actorUserId,
            actingLegalEntityId: event.actingLegalEntityId,
            producer: event.producer ?? "apps/worker",
          }),
      };
    },
  };
}
