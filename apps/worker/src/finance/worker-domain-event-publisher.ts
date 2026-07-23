import type { IDomainEventPublisher } from "@auction/finance-runtime";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";

export function workerDomainEventPublisher(sink: IWorkerDomainEventSink): IDomainEventPublisher {
  return {
    publish: async (event) => {
      await sink.publish({
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        actorUserId: event.actorUserId,
        actingLegalEntityId: event.actingLegalEntityId,
        producer: event.producer ?? "apps/worker",
      });
    },
  };
}
