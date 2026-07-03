/**
 * Shared error shape returned by the onsite-event guest (public RSVP) and
 * staff (admin) services. Kept in one place so both interfaces — and the
 * `isOnsiteEventRsvpServiceError` type guard used by both route files —
 * agree on the same shape without importing from each other.
 */
export type OnsiteEventRsvpServiceError = {
  message: string;
  status: number;
  code?: string;
};

/** Shared error shape for pass rendering and staff check-in services. */
export type OnsiteEventCheckInServiceError = OnsiteEventRsvpServiceError;
