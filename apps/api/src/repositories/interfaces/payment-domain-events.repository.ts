import type { DomainEventInput } from "../../services/domain-event.publisher.js";

/** Persists payment aggregate domain events without exposing raw Database to callers. */
export interface IPaymentDomainEventsRepository {
  publish(event: DomainEventInput): Promise<void>;
}
