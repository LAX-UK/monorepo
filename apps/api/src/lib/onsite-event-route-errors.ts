import type { OnsiteEventCheckInServiceError } from "../services/interfaces/onsite-event-service-errors.js";
import type { OnsiteEventRsvpServiceError } from "../services/interfaces/onsite-event-service-errors.js";

export function isOnsiteEventRsvpServiceError(
  value: unknown,
): value is OnsiteEventRsvpServiceError {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as OnsiteEventRsvpServiceError).status === "number" &&
    "message" in value
  );
}

export function isOnsiteEventCheckInServiceError(
  value: unknown,
): value is OnsiteEventCheckInServiceError {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as OnsiteEventCheckInServiceError).status === "number" &&
    "message" in value
  );
}
