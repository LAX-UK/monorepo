import { DomainEventContractError } from "./domain-event-contract-error.js";
import { parseDomainEventPayload } from "./validate.js";

/** Validates before outbound CRM/accounting delivery; throws terminal contract errors. */
export function assertDomainEventConsumerContract(event: {
  eventType: string;
  payload: unknown;
  schemaVersion?: number;
}): void {
  const result = parseDomainEventPayload(event.eventType, event.schemaVersion ?? 1, event.payload);
  if (!result.ok) {
    throw new DomainEventContractError(event.eventType, result.error);
  }
}
