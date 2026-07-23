import { DomainEventContractError } from "./domain-event-contract-error.js";
import { parseDomainEventPayload } from "./validate.js";

export type DomainEventPublishValidateMode = "off" | "observe" | "enforce";

export type DomainEventPublishInput = {
  eventType: string;
  payload: unknown;
  schemaVersion?: number;
};

export function guardDomainEventPublish(
  mode: DomainEventPublishValidateMode,
  event: DomainEventPublishInput,
  onObserve?: (detail: { eventType: string; error: string }) => void,
): void {
  if (mode === "off") return;

  const result = parseDomainEventPayload(event.eventType, event.schemaVersion ?? 1, event.payload);

  if (result.ok) return;

  if (mode === "observe") {
    onObserve?.({ eventType: event.eventType, error: result.error });
    return;
  }

  throw new DomainEventContractError(event.eventType, result.error);
}
