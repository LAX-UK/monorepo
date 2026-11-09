import type { CollectorIssue } from "@auction/domain";
import type { Result } from "neverthrow";

/**
 * Every way a collection request is refused, with the status it is answered with. The codes are
 * what the booking page switches on; the messages are plain sentences it can show as they are.
 */
const REFUSALS = {
  /** The person may not do collections for this account at all. */
  insufficient_entity_role: [403, "You can't manage collections for this account."],
  /** A platform admin viewing as the account only reads. */
  read_only: [403, "You're viewing this account, so you can't change its collections."],
  /** A lot that is not this account's, or does not exist: the same answer, so nothing is leaked. */
  lot_not_found: [404, "We couldn't find one of those lots."],
  booking_not_found: [404, "We couldn't find that collection."],
  /** The person may not book this lot (a buyer agent for a lot they did not win, a viewer). */
  lot_not_yours_to_book: [403, "You can't book a collection for one of those lots."],
  no_lots: [400, "Choose at least one lot."],
  too_many_lots: [400, "A visit can hold up to 20 lots."],
  duplicate_lots: [400, "A lot was chosen twice."],
  mixed_places: [422, "Those lots are collected from different places. Book them separately."],
  lot_without_place: [409, "This lot has no collection place, so it can't be booked online."],
  lot_not_collectable: [422, "One of those lots can't be booked for collection."],
  online_booking_off: [409, "Online booking isn't open yet. Email us and we'll find a time."],
  too_many_visits: [
    409,
    "You already have the most collections we can hold for one account. Cancel one, or get in touch.",
  ],
  collector_invalid: [422, "Check who is collecting."],
  slot_unknown: [422, "That time isn't offered."],
  notice_passed: [422, "It's too late to book that time online."],
  slot_full: [409, "That time has just been taken. Pick another."],
  cutoff_passed: [409, "It's too late to change this online."],
  booking_closed: [409, "This collection can't be changed any more."],
  /** The booking changed since the person last read it, or it is no longer live. */
  booking_changed: [409, "This collection has changed. Reload it and try again."],
  /** The same key was used for a different request. */
  idempotency_key_reused: [409, "That booking attempt was already used for a different request."],
  unavailable: [503, "We couldn't check collections just now. Try again in a moment."],
} as const;

export type CollectionVisitErrorCode = keyof typeof REFUSALS;

export type CollectionVisitError = {
  code: CollectionVisitErrorCode;
  status: 400 | 403 | 404 | 409 | 422 | 503;
  message: string;
  /** For `lot_not_collectable` and `lot_not_yours_to_book`: the first lot and why. */
  lotId?: string;
  reason?: string;
  /** For `collector_invalid`: each problem and the field it belongs to. */
  issues?: CollectorIssue[];
  /** For `online_booking_off`: where to write instead. */
  bookingEmail?: string | null;
};

export type CollectionVisitResult<T> = Result<T, CollectionVisitError>;

export function visitError(
  code: CollectionVisitErrorCode,
  extra: Partial<Omit<CollectionVisitError, "code" | "status">> = {},
): CollectionVisitError {
  const [status, message] = REFUSALS[code];
  return { code, status, message, ...extra };
}
