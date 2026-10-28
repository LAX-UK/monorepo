/**
 * What happens to a member's bidding for an organisation when they are removed. Placed bids are
 * commitments in the sale and stand. Standing instructions, which would bid again on the
 * organisation's behalf, stop: the bidding engine already refuses non-members, so leaving them
 * in place would only fail later and silently.
 */
export type StandingInstructionKind = "auto_bid" | "absentee";

export type StandingInstructionCandidate = {
  kind: StandingInstructionKind;
  /** The lot's status (`scheduled`, `active`, `ended`, …). */
  lotStatus: string;
  /** The absentee bid's own status; `null` for an auto-bid ceiling. */
  instructionStatus: string | null;
};

/** Why the instruction stopped, as recorded on it and in its audit entry. */
export const MEMBER_REMOVED_STOP_REASON = "member_removed";

/** When each kind can still bid again, so stopping it matters. */
const STILL_ACTIVE: Record<
  StandingInstructionKind,
  (candidate: StandingInstructionCandidate) => boolean
> = {
  auto_bid: (c) => c.lotStatus === "scheduled" || c.lotStatus === "active",
  absentee: (c) => c.instructionStatus === "scheduled",
};

/** Whether removal stops this instruction. */
export function stopsOnRemoval(candidate: StandingInstructionCandidate): boolean {
  return STILL_ACTIVE[candidate.kind](candidate);
}
