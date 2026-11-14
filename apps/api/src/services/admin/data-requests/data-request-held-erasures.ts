import type { EnquiryHoldEnd } from "@auction/domain";

/**
 * Why a request's erasure is still waiting. `running` and `open_deal` are re-run by the schedule;
 * `end_unknown`, `still_held` and `cannot_run` need staff.
 */
export type HeldErasureReason =
  | "running"
  | "open_deal"
  | "end_unknown"
  | "still_held"
  | "cannot_run";

/** What the Data requests queue shows for a request staff must settle by hand. */
export type HeldErasureFlag = {
  reference: string;
  reason: HeldErasureReason;
  /** When the hold ended or ends, as an ISO date-time; `null` when there is no date. */
  heldUntil: string | null;
};

/** How a held erasure is kept: re-run when `recheckAt` passes, or shown to staff. */
export type HeldErasurePlan =
  | { state: "waiting"; reason: "running" | "open_deal"; heldUntil: Date | null; recheckAt: Date }
  | { state: "needs_staff"; reason: "end_unknown"; heldUntil: null; recheckAt: null };

/** An open deal has no end yet, so its request is looked at again this often. */
export const OPEN_DEAL_RECHECK_DAYS = 30;

/**
 * What to do with an erasure a deal held. A hold with no end date is shown to staff instead of
 * waiting quietly; one with a date is re-run then; one behind an open deal is re-run every
 * {@link OPEN_DEAL_RECHECK_DAYS} days until the deal ends.
 */
export function planHeldErasure(hold: EnquiryHoldEnd | undefined, now: Date): HeldErasurePlan {
  if (!hold || hold.withoutEnd) {
    return { state: "needs_staff", reason: "end_unknown", heldUntil: null, recheckAt: null };
  }
  if (hold.until) {
    return { state: "waiting", reason: "running", heldUntil: hold.until, recheckAt: hold.until };
  }
  const recheckAt = new Date(now.getTime() + OPEN_DEAL_RECHECK_DAYS * 86_400_000);
  return { state: "waiting", reason: "open_deal", heldUntil: null, recheckAt };
}

/** Bid's record of the data requests whose enquiry erasure a private sale deal held. */
export interface IHeldErasureLog {
  /** Keeps the request's held erasure as planned, replacing any earlier record of it. */
  held(input: {
    reference: string;
    requestedByUserId: string;
    plan: HeldErasurePlan;
  }): Promise<void>;
  /** The erasure completed, so nothing is held for the request any more. */
  cleared(reference: string): Promise<void>;
  /** The requests staff must settle by hand, for the queue. */
  needingStaff(): Promise<HeldErasureFlag[]>;
}
