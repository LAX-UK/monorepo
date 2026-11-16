import { collectionRequestCanonical as canonical } from "@auction/domain";
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
 * The request a booking was made with, as one string (see `collectionRequestCanonical` in
 * @auction/domain, which the demo seed shares so its bookings carry a real fingerprint).
 * Browser-safe: hashing it is the repository's job.
 */
export function collectionRequestCanonical(request: FingerprintedRequest): string {
  return canonical(request);
}
