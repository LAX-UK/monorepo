import type { CollectorIssue, TransitionRefusal } from "@auction/domain";
import type { Result } from "neverthrow";

/**
 * Every way a desk request is refused, with its status. The screens switch on the code and show
 * the message as a sentence; a refusal for a lot names it.
 */
const REFUSALS = {
  booking_not_found: [404, "We couldn't find that collection."],
  place_not_set_up: [404, "That place has no collection settings yet."],
  invalid_date: [400, "Choose a valid day."],
  no_lots: [400, "Tick at least one lot."],
  lot_not_in_booking: [422, "One of those lots isn't in this collection."],
  /** A ticked lot has not been released by staff; hand-over waits for release. */
  not_released: [409, "Release every ticked lot before handing it over."],
  /** A check opened after the booking was made (identity, source of funds, finance, refund, dispute). */
  hold_open: [409, "A check has opened on this purchase, so it can't be handed over yet."],
  booking_closed: [409, "This collection can't be changed any more."],
  /** Only staff act at the desk; a client's own limits (their cut-off) are not the desk's. */
  actor_not_allowed: [403, "You can't do that at the desk."],
  /** A client's cut-off; the desk is not bound by it, so reaching it here is a mistake to report. */
  cutoff_passed: [409, "The time to change this collection has passed."],
  undo_window_passed: [409, "It's too late to undo this hand-over."],
  too_early: [409, "A visit can be marked not collected once its time has started."],
  /** The booking changed since staff read it, or is no longer live. */
  booking_changed: [409, "This collection has changed. Reload it and try again."],
  /** A lot's fulfilment moved (another desk, or Lot fulfilment) while this was being done. */
  lot_changed: [409, "A lot's fulfilment has changed since you opened this. Reload and try again."],
  idempotency_key_reused: [409, "That booking attempt was already used for a different request."],
  slot_unknown: [422, "That time isn't offered."],
  /** Every place is taken: staff may go over capacity with a reason. */
  slot_full: [409, "That time is full. Add a reason to book over capacity."],
  /** The notice has passed: staff may book inside it with a reason. */
  notice_passed: [422, "That time is inside the notice period. Add a reason to book it."],
  lot_not_found: [404, "We couldn't find one of those lots for that account."],
  lot_not_collectable: [422, "One of those lots can't be booked for collection."],
  too_many_lots: [400, "A visit can hold up to 20 lots."],
  duplicate_lots: [400, "A lot was chosen twice."],
  mixed_places: [422, "Those lots are collected from different places. Book them separately."],
  collector_invalid: [422, "Check who is collecting."],
} as const;

export type CollectionDeskErrorCode = keyof typeof REFUSALS;

export type CollectionDeskError = {
  code: CollectionDeskErrorCode;
  status: 400 | 403 | 404 | 409 | 422;
  message: string;
  lotId?: string;
  lotIds?: string[];
  reason?: string;
  issues?: CollectorIssue[];
};

export type CollectionDeskResult<T> = Result<T, CollectionDeskError>;

export function deskError(
  code: CollectionDeskErrorCode,
  extra: Partial<Omit<CollectionDeskError, "code" | "status">> = {},
): CollectionDeskError {
  const [status, message] = REFUSALS[code];
  return { code, status, message, ...extra };
}

/**
 * The desk's refusal for a booking-state transition that was not allowed. Every reason the state
 * machine can give has an answer here; a new reason will not compile until it is given one.
 */
export function transitionRefusal(reason: TransitionRefusal): CollectionDeskError {
  switch (reason) {
    case "booking_closed":
      return deskError("booking_closed");
    case "actor_not_allowed":
      return deskError("actor_not_allowed");
    case "cutoff_passed":
      return deskError("cutoff_passed");
    case "too_early":
      return deskError("too_early");
    case "undo_window_passed":
      return deskError("undo_window_passed");
  }
}
