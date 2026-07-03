import type { DomainEventInput } from "../lib/domain-event.types.js";

/** Persists payment aggregate domain events without exposing raw Database to callers. */
export interface IPaymentDomainEventsRepository {
  publish(event: DomainEventInput): Promise<void>;
}
