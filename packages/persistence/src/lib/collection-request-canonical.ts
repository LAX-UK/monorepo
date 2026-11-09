import type { NewCollectionBooking } from "../interfaces/collection-booking.repository.js";

/** What makes two booking requests the same request. */
export type FingerprintedRequest = Pick<
  NewCollectionBooking,
  | "legalEntityId"
  | "venueId"
  | "slotStart"
  | "lotIds"
  | "collector"
  | "bookedVia"
  | "bookedByUserId"
  | "overCapacityReason"
>;

/**
 * The request a booking was made with, as one string: the same request always gives the same
 * string and anything the person chose differently gives another. It covers the account, place,
 * time, the lots (in any order), who collects and who made the request, and leaves out what the
 * server fills in (the authorisation time, the policy version, the capacity), which can differ
 * between two sends of the same request. Browser-safe: hashing it is the repository's job.
 */
export function collectionRequestCanonical(request: FingerprintedRequest): string {
  return JSON.stringify([
    request.legalEntityId,
    request.venueId,
    request.slotStart.toISOString(),
    [...new Set(request.lotIds)].sort(),
    request.collector.kind,
    request.collector.name,
    request.collector.email,
    request.collector.company,
    request.collector.userId,
    request.collector.authorisedByUserId,
    request.bookedVia,
    request.bookedByUserId,
    request.overCapacityReason,
  ]);
}
