import type { CollectionAvailability, CollectionVisitView } from "@auction/types";
import { dayOfSlot, firstOpenDay } from "./collect-calendar";
import type { CollectFailure } from "./collect-errors";
import type { CollectFormError, CollectFormState, CollectorChoice } from "./collect-form";

/** The booking page's whole state: what is on offer, what the person has chosen, what went wrong. */
export type CollectState = CollectFormState & {
  availability: CollectionAvailability;
  day: string | null;
  /** Counts failed submits, so the error summary takes focus once for each. */
  attempts: number;
  /** The sentences under the fields, after a submit that failed the check. */
  errors: CollectFormError[];
  /** What the server turned the booking away for. */
  failure: CollectFailure | null;
  phase: "idle" | "submitting" | "refreshing";
};

export type CollectAction =
  | { type: "toggle_lot"; lotId: string }
  | { type: "select_day"; date: string }
  | { type: "select_slot"; start: string }
  | { type: "choose_collector"; collector: CollectorChoice }
  | { type: "set_field"; field: "name" | "email" | "company"; value: string }
  | { type: "set_authorised"; authorised: boolean }
  | { type: "invalid"; errors: CollectFormError[] }
  | { type: "submit" }
  | { type: "failed"; failure: CollectFailure }
  | { type: "refresh" }
  | { type: "refreshed"; availability: CollectionAvailability }
  | { type: "dismiss_failure" };

/** A slot is bookable when it still has a place and its day is not closed to booking. */
function openSlotStarts(availability: CollectionAvailability): Set<string> {
  return new Set(
    availability.days.flatMap((day) =>
      day.slots.filter((slot) => slot.state === "open" && slot.placesLeft > 0).map((s) => s.start),
    ),
  );
}

/**
 * The page as it opens. Lots that can be booked are ticked. A visit being changed keeps its own
 * lots, time and collector, so a failed change never leaves the person without their time.
 */
export function initialCollectState(input: {
  availability: CollectionAvailability;
  visit: CollectionVisitView | null;
  myName: string;
}): CollectState {
  const { availability, visit } = input;
  // A new booking starts with every lot that can be collected ticked: the ones asked for first,
  // then the account's others, in the order the server sent them.
  const ticked = visit
    ? visit.lots.filter((lot) => lot.active).map((lot) => lot.lotId)
    : availability.lots.filter((lot) => lot.collectable).map((lot) => lot.lotId);
  const slot = visit ? visit.start : null;
  const day = (slot ? dayOfSlot(availability.days, slot) : null) ?? firstOpenDay(availability.days);
  const kind = visit?.collector.kind ?? "self";
  return {
    availability,
    lotIds: ticked,
    slotStart: slot,
    day,
    collector: kind,
    name: kind === "self" ? "" : (visit?.collector.name ?? ""),
    email: visit?.collector.email ?? "",
    company: visit?.collector.company ?? "",
    // The person authorised a third party when they booked; changing keeps it only if they tick again.
    authorised: false,
    attempts: 0,
    errors: [],
    failure: null,
    phase: "idle",
  };
}

export function collectReducer(state: CollectState, action: CollectAction): CollectState {
  switch (action.type) {
    case "toggle_lot": {
      const on = state.lotIds.includes(action.lotId);
      return {
        ...state,
        lotIds: on
          ? state.lotIds.filter((id) => id !== action.lotId)
          : [...state.lotIds, action.lotId],
        errors: state.errors.filter((error) => error.fieldId !== "collect-lots"),
      };
    }
    case "select_day":
      // A different day has different times: the time chosen on another day no longer stands.
      return {
        ...state,
        day: action.date,
        slotStart:
          state.slotStart && dayOfSlot(state.availability.days, state.slotStart) === action.date
            ? state.slotStart
            : null,
      };
    case "select_slot":
      return {
        ...state,
        slotStart: action.start,
        failure: state.failure?.kind === "slot_taken" ? null : state.failure,
        errors: state.errors.filter((error) => error.fieldId !== "collect-time"),
      };
    case "choose_collector":
      return {
        ...state,
        collector: action.collector,
        errors: state.errors.filter((error) => !error.fieldId.startsWith("collect-collector")),
      };
    case "set_field":
      return {
        ...state,
        [action.field]: action.value,
        errors: state.errors.filter(
          (error) => error.fieldId !== `collect-collector-${action.field}`,
        ),
      };
    case "set_authorised":
      return {
        ...state,
        authorised: action.authorised,
        errors: state.errors.filter((error) => error.fieldId !== "collect-collector-authorisation"),
      };
    case "invalid":
      return { ...state, errors: action.errors, attempts: state.attempts + 1, failure: null };
    case "submit":
      return { ...state, phase: "submitting", errors: [], failure: null };
    case "failed":
      return {
        ...state,
        phase: "idle",
        failure: action.failure,
        attempts: state.attempts + 1,
        errors:
          action.failure.kind === "collector"
            ? action.failure.issues.map((issue) => ({
                fieldId: issue.fieldId,
                message: issue.message,
              }))
            : [],
      };
    case "refresh":
      return { ...state, phase: "refreshing" };
    case "refreshed": {
      const open = openSlotStarts(action.availability);
      const slotStillOpen = state.slotStart !== null && open.has(state.slotStart);
      const day =
        state.day &&
        action.availability.days.some((d) => d.date === state.day && d.state === "open")
          ? state.day
          : firstOpenDay(action.availability.days);
      return {
        ...state,
        availability: action.availability,
        phase: "idle",
        slotStart: slotStillOpen ? state.slotStart : null,
        day,
        // A lot that can no longer be booked is unticked, not kept ticked behind a reason.
        lotIds: state.lotIds.filter(
          (id) => action.availability.lots.find((lot) => lot.lotId === id)?.collectable ?? false,
        ),
      };
    }
    case "dismiss_failure":
      return { ...state, failure: null };
  }
}
