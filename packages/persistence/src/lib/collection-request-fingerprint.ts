import { createHash } from "node:crypto";
import type { NewCollectionBooking } from "../interfaces/collection-booking.repository.js";

/** What makes two booking requests the same request. */
type FingerprintedRequest = Pick<
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
 * A digest of the request a booking was made with, stored beside its idempotency key. A repeat of
 * the same request (a double tap, a retry) has the same digest and gets the booking back; the same
 * key with anything different has another digest and is refused, so a reused key cannot make one
 * person's request return, or be mistaken for, another's.
 *
 * It covers what the person chose: account, place, time, the lots (in any order), who collects and
 * who made the request. It leaves out what the server fills in (the authorisation time, the policy
 * version, the capacity) because those can differ between two sends of the same request.
 */
export function collectionRequestFingerprint(request: FingerprintedRequest): string {
  const canonical = JSON.stringify([
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
  return createHash("sha256").update(canonical).digest("hex");
}
