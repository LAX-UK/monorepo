import { DOMAIN_EVENT_REGISTRY, type LiveDomainEventType } from "./registry.js";
import type { DomainEventConsumer } from "./types.js";

/** Event types whose catalog entry lists the given async consumer. */
export function listDomainEventTypesForConsumer(
  consumer: DomainEventConsumer,
): LiveDomainEventType[] {
  return (Object.keys(DOMAIN_EVENT_REGISTRY) as LiveDomainEventType[]).filter((eventType) =>
    DOMAIN_EVENT_REGISTRY[eventType].consumers.includes(consumer),
  );
}
