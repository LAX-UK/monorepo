import type { LotStatus, UnsoldLotChoiceKind, UnsoldLotChoiceStatus } from "@auction/types";
import { type EntityActor, entityActorCan } from "./entity-capabilities.js";
import { moneyEq, moneyGte, moneyLt } from "./money-compare.js";
import { hasConfiguredReserve } from "./reserve.js";

/**
 * What happens to a consigned lot that ended without selling. The seller asks for one of three
 * outcomes; a specialist confirms it as asked, adjusts it, or records it for a seller who told
 * them directly. A confirmed choice is final for that unsold outcome.
 */
export type UnsoldChoiceTransition = "request" | "change" | "confirm" | "adjust" | "record";

/** `none` is the state before anyone has chosen. */
export type UnsoldChoiceState = UnsoldLotChoiceStatus | "none";

type UnsoldChoiceRule = { from: readonly UnsoldChoiceState[]; to: UnsoldLotChoiceStatus };

const UNSOLD_CHOICE_TRANSITIONS: Record<UnsoldChoiceTransition, UnsoldChoiceRule> = {
  /** The seller chooses. */
  request: { from: ["none"], to: "requested" },
  /** The seller changes their mind before a specialist confirms. */
  change: { from: ["requested"], to: "requested" },
  /** A specialist confirms the request as asked. */
  confirm: { from: ["requested"], to: "confirmed" },
  /** A specialist confirms a different outcome or reserve, with a note. */
  adjust: { from: ["requested"], to: "confirmed" },
  /** A specialist records the outcome for a seller who told them directly. */
  record: { from: ["none"], to: "confirmed" },
};

export function canTransitionUnsoldChoice(
  from: UnsoldChoiceState,
  transition: UnsoldChoiceTransition,
): boolean {
  return UNSOLD_CHOICE_TRANSITIONS[transition].from.includes(from);
}

export function nextUnsoldChoiceStatus(
  from: UnsoldChoiceState,
  transition: UnsoldChoiceTransition,
): UnsoldLotChoiceStatus {
  if (!canTransitionUnsoldChoice(from, transition)) {
    throw new Error(`Invalid unsold choice transition: ${transition} from ${from}`);
  }
  return UNSOLD_CHOICE_TRANSITIONS[transition].to;
}

/** The lot facts the unsold rules depend on. */
export type UnsoldLotFacts = {
  status: LotStatus;
  winnerId: string | null;
  reservePrice: string | null;
};

/** Statuses in which a lot has finished without a buyer, once it has no winner. */
export const UNSOLD_LOT_END_STATUSES: readonly LotStatus[] = ["ended", "voided"];

const ENDED_STATUSES: ReadonlySet<LotStatus> = new Set(UNSOLD_LOT_END_STATUSES);

/** A lot ended without a sale: closed with no winner, or voided at close. */
export function lotEndedUnsold(lot: Pick<UnsoldLotFacts, "status" | "winnerId">): boolean {
  return ENDED_STATUSES.has(lot.status) && lot.winnerId === null;
}

/** Whether `actor` may choose for the account; a person's own profile always may. */
export function canChooseUnsoldOutcome(actor: EntityActor | null): boolean {
  return actor === null || entityActorCan(actor, "entity.consignments.after_sale");
}

export type RelistReserveRefusal = "reserve_invalid" | "reserve_not_lower" | "reserve_below_floor";

/**
 * A lower reserve for a relist. It must be a positive amount, lower than the reserve the lot
 * ended with (to keep that reserve, ask for none), and never below the specialist's floor.
 */
export function relistReserveRefusal(input: {
  reserve: string;
  currentReserve: string | null;
  floor: string | null;
}): RelistReserveRefusal | null {
  if (!/^\d+(\.\d{1,2})?$/.test(input.reserve.trim()) || !hasConfiguredReserve(input.reserve)) {
    return "reserve_invalid";
  }
  if (
    hasConfiguredReserve(input.currentReserve) &&
    !moneyLt(input.reserve, input.currentReserve ?? "")
  ) {
    return "reserve_not_lower";
  }
  if (hasConfiguredReserve(input.floor) && !moneyGte(input.reserve, input.floor ?? "")) {
    return "reserve_below_floor";
  }
  return null;
}

export type UnsoldChoiceRefusal =
  | "not_unsold"
  | "already_confirmed"
  | "forbidden_role"
  | "reserve_only_for_relist"
  | "note_required"
  | RelistReserveRefusal;

export type UnsoldChoiceDecision =
  | { kind: "record"; transition: UnsoldChoiceTransition; status: UnsoldLotChoiceStatus }
  | { kind: "refused"; reason: UnsoldChoiceRefusal; message: string };

export function unsoldChoiceRefusalMessage(reason: UnsoldChoiceRefusal): string {
  switch (reason) {
    case "not_unsold":
      return "This lot has not ended unsold, so there is nothing to choose yet.";
    case "already_confirmed":
      return "A specialist has already confirmed what happens next.";
    case "forbidden_role":
      return "Only an owner or admin can choose what happens next.";
    case "reserve_only_for_relist":
      return "A reserve can only be set for a relist.";
    case "note_required":
      return "Add a note for the seller saying why this differs from what they asked.";
    case "reserve_invalid":
      return "Enter the reserve as an amount, for example 4500.";
    case "reserve_not_lower":
      return "The new reserve must be lower than the current one. Leave it empty to keep it.";
    case "reserve_below_floor":
      return "The reserve is lower than your specialist accepts for a relist.";
  }
}

function refuse(reason: UnsoldChoiceRefusal): UnsoldChoiceDecision {
  return { kind: "refused", reason, message: unsoldChoiceRefusalMessage(reason) };
}

function record(from: UnsoldChoiceState, transition: UnsoldChoiceTransition): UnsoldChoiceDecision {
  return { kind: "record", transition, status: nextUnsoldChoiceStatus(from, transition) };
}

function reserveRefusal(
  choice: UnsoldLotChoiceKind,
  reserve: string | null,
  lot: UnsoldLotFacts,
  floor: string | null,
): UnsoldChoiceRefusal | null {
  if (reserve === null) return null;
  if (choice !== "relist") return "reserve_only_for_relist";
  return relistReserveRefusal({ reserve, currentReserve: lot.reservePrice, floor });
}

function sameReserve(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return moneyEq(a, b);
}

/** The seller's request: who may choose, when, and which reserve they may ask for. */
export function decideUnsoldChoiceRequest(input: {
  lot: UnsoldLotFacts;
  current: UnsoldChoiceState;
  actor: EntityActor | null;
  choice: UnsoldLotChoiceKind;
  reserve: string | null;
  floor: string | null;
}): UnsoldChoiceDecision {
  if (!lotEndedUnsold(input.lot)) return refuse("not_unsold");
  if (!canChooseUnsoldOutcome(input.actor)) return refuse("forbidden_role");
  if (input.current === "confirmed") return refuse("already_confirmed");
  const reserve = reserveRefusal(input.choice, input.reserve, input.lot, input.floor);
  if (reserve) return refuse(reserve);
  return record(input.current, input.current === "none" ? "request" : "change");
}

/**
 * The specialist's decision. Confirming exactly what was asked is a confirmation; anything else
 * is an adjustment, which tells the seller why in a note. Staff are not held to the floor (it is
 * theirs) but a reserve must still be a real amount, and only a relist has one.
 */
export function decideUnsoldChoiceConfirmation(input: {
  lot: UnsoldLotFacts;
  current: UnsoldChoiceState;
  requested: { choice: UnsoldLotChoiceKind | null; reserve: string | null } | null;
  choice: UnsoldLotChoiceKind;
  reserve: string | null;
  note?: string | null;
}): UnsoldChoiceDecision {
  if (!lotEndedUnsold(input.lot)) return refuse("not_unsold");
  if (input.current === "confirmed") return refuse("already_confirmed");
  if (input.reserve !== null) {
    if (input.choice !== "relist") return refuse("reserve_only_for_relist");
    const refusal = relistReserveRefusal({
      reserve: input.reserve,
      currentReserve: null,
      floor: null,
    });
    if (refusal) return refuse(refusal);
  }
  if (input.current === "none") return record("none", "record");
  const asAsked =
    input.requested?.choice === input.choice && sameReserve(input.requested.reserve, input.reserve);
  if (!asAsked && !input.note?.trim()) return refuse("note_required");
  return record(input.current, asAsked ? "confirm" : "adjust");
}

/** An unsold lot is waiting on the seller until someone has chosen. */
export function unsoldChoiceAwaitingSeller(
  lot: Pick<UnsoldLotFacts, "status" | "winnerId">,
  current: UnsoldChoiceState,
): boolean {
  return lotEndedUnsold(lot) && current === "none";
}
