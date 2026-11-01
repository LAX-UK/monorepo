import type { LotStatus } from "@auction/types";
import { moneyGt } from "../money-compare.js";
import { bidOutcome } from "../search-result-states.js";

/** Where the viewer's registration for the lot's sale stands. */
export type LotRegistrationState = "none" | "pending" | "approved" | "declined";

/** Where the viewer stands on a lot, in the words the page uses for it. */
export type LotPosition = "none" | "leading" | "outbid" | "maximum_set" | "won" | "lost";

/** What the stored registration says; `withdrawn` counts as never having registered. */
export type StoredRegistrationStatus = "pending" | "approved" | "rejected" | "withdrawn";

/** Raw facts about the viewer's account on one lot, as a reader finds them. */
export type LotViewerFacts = {
  lotStatus: LotStatus;
  /** The lot's current price (hammer once ended), a decimal string. */
  currentPrice: string;
  registration: StoredRegistrationStatus | null;
  /** The viewer's account placed the winning bid on a lot still open. */
  leading: boolean;
  /** The viewer's account won the lot. */
  won: boolean;
  /** The viewer's account has placed at least one bid on the lot. */
  hasBid: boolean;
  /** The highest bid the account placed, or `null`. */
  highestBid: string | null;
  /** The highest ceiling the account holds: a proxy maximum or a scheduled absentee bid. */
  maxBid: string | null;
};

export type LotViewerState = {
  registration: LotRegistrationState;
  position: LotPosition;
  myHighestBid: string | null;
  /** Shown only while it can still bid: a spent ceiling is history, not a maximum "set". */
  myMaxBid: string | null;
};

const REGISTRATION: Record<StoredRegistrationStatus, LotRegistrationState> = {
  pending: "pending",
  approved: "approved",
  rejected: "declined",
  withdrawn: "none",
};

export function registrationState(stored: StoredRegistrationStatus | null): LotRegistrationState {
  return stored ? REGISTRATION[stored] : "none";
}

function positionOf(facts: LotViewerFacts): LotPosition {
  if (facts.lotStatus === "draft" || facts.lotStatus === "scheduled") {
    return facts.maxBid !== null || facts.hasBid ? "maximum_set" : "none";
  }
  if (!facts.hasBid) return facts.won ? "won" : "none";
  const outcome = bidOutcome({
    lotStatus: facts.lotStatus,
    leading: facts.leading,
    won: facts.won,
  });
  return outcome ?? "none";
}

function liveMaximum(facts: LotViewerFacts, position: LotPosition): string | null {
  if (facts.maxBid === null) return null;
  if (position === "maximum_set") return facts.maxBid;
  if (position !== "leading") return null;
  return moneyGt(facts.maxBid, facts.currentPrice) ? facts.maxBid : null;
}

/** The one reader of "where do I stand", shared by the lot page, cards and the phone bar. */
export function readLotViewerState(facts: LotViewerFacts): LotViewerState {
  const position = positionOf(facts);
  return {
    registration: registrationState(facts.registration),
    position,
    myHighestBid: facts.highestBid,
    myMaxBid: liveMaximum(facts, position),
  };
}

/** The state of a signed-out visitor, or of someone with no part in the lot. */
export const NO_VIEWER_STATE: LotViewerState = {
  registration: "none",
  position: "none",
  myHighestBid: null,
  myMaxBid: null,
};
