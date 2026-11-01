import { type BidFailure, type BidMode, keepMaximum } from "@auction/domain";

/**
 * Where the bid dialog is:
 * - `choosing`: the bidder is looking at the next bid or picking a maximum, ready to confirm;
 * - `submitting`: the bid is on its way and nothing can be changed;
 * - `placed`: the server accepted it and the dialog is about to close.
 * A failure never leaves `choosing`: the dialog stays open, says what happened and offers the way on.
 */
export type BidDialogPhase = "choosing" | "submitting" | "placed";

export type BidDialogState = {
  phase: BidDialogPhase;
  mode: BidMode;
  /** The next bid on screen. It only changes in front of the bidder, with a notice saying so. */
  shownNextBid: string;
  maximum: string | null;
  failure: BidFailure | null;
  /** Counts changes to what will be sent. A retry of the same bid keeps the count, and so the key. */
  attempt: number;
};

export type BidDialogAction =
  | { type: "chose_mode"; mode: BidMode; ladder: readonly string[] }
  | { type: "chose_maximum"; maximum: string }
  | { type: "submitted" }
  | { type: "placed" }
  | { type: "failed"; failure: BidFailure; ladder: readonly string[] }
  | { type: "price_moved"; nextBid: string; ladder: readonly string[] }
  | { type: "used_amount"; amount: string }
  | { type: "dismissed_notice" };

export function openBidDialog(input: {
  mode: BidMode;
  nextBid: string;
  ladder: readonly string[];
}): BidDialogState {
  return {
    phase: "choosing",
    mode: input.mode,
    shownNextBid: input.nextBid,
    maximum: keepMaximum(input.ladder, null),
    failure: null,
    attempt: 0,
  };
}

function changed(state: BidDialogState, patch: Partial<BidDialogState>): BidDialogState {
  return { ...state, failure: null, ...patch, attempt: state.attempt + 1 };
}

/** The new next bid a refusal names, when it names one. */
function nextBidOf(failure: BidFailure): string | null {
  if (failure.kind === "moved") return failure.nextBid;
  if (failure.kind !== "refused") return null;
  return failure.refusal.code === "outbid_during_confirm"
    ? (failure.refusal.details.nextBidAmount ?? null)
    : null;
}

/** Pure, so every step of the dialog is a test. */
export function reduceBidDialog(state: BidDialogState, action: BidDialogAction): BidDialogState {
  switch (action.type) {
    case "chose_mode":
      if (state.phase !== "choosing" || action.mode === state.mode) return state;
      return changed(state, {
        mode: action.mode,
        maximum: keepMaximum(action.ladder, state.maximum),
      });
    case "chose_maximum":
      if (state.phase !== "choosing" || action.maximum === state.maximum) return state;
      return changed(state, { maximum: action.maximum });
    case "submitted":
      return state.phase === "choosing" ? { ...state, phase: "submitting", failure: null } : state;
    case "placed":
      return { ...state, phase: "placed", failure: null };
    case "failed": {
      const nextBid = nextBidOf(action.failure);
      // The server names the new next bid; the dialog knows which one the bidder was looking at.
      const failure: BidFailure = nextBid
        ? { kind: "moved", seenNextBid: state.shownNextBid, nextBid }
        : action.failure;
      // Nothing the bidder pressed changes unless the notice says so; a dropped connection keeps
      // the attempt, so the retry carries the same key and cannot place the bid twice.
      const keepAttempt = action.failure.kind === "unreachable";
      return {
        ...state,
        phase: "choosing",
        failure,
        shownNextBid: nextBid ?? state.shownNextBid,
        maximum: nextBid ? keepMaximum(action.ladder, state.maximum) : state.maximum,
        attempt: keepAttempt ? state.attempt : state.attempt + 1,
      };
    }
    case "price_moved": {
      if (state.phase !== "choosing" || action.nextBid === state.shownNextBid) return state;
      return {
        ...state,
        failure: { kind: "moved", seenNextBid: state.shownNextBid, nextBid: action.nextBid },
        shownNextBid: action.nextBid,
        maximum: keepMaximum(action.ladder, state.maximum),
        attempt: state.attempt + 1,
      };
    }
    case "used_amount":
      if (state.phase !== "choosing") return state;
      return state.mode === "maximum"
        ? changed(state, { maximum: action.amount })
        : changed(state, { shownNextBid: action.amount });
    case "dismissed_notice":
      return state.failure ? { ...state, failure: null } : state;
  }
}
