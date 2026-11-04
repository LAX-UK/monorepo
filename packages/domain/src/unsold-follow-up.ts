import type { UnsoldLotChoiceKind } from "@auction/types";
import { hasConfiguredReserve } from "./reserve.js";

/**
 * The staff work a confirmed unsold-lot choice leaves behind. A relist finishes when the lot goes
 * back into inventory, which is also when the agreed reserve is put on it; the other two finish
 * when staff say the lot has been returned to its seller, or handed to the private sales team.
 */
export type UnsoldFollowUpStatus = "open" | "done";

/** What a confirmed choice opens, from the choice the specialist confirmed. */
export type UnsoldFollowUpPlan = { kind: UnsoldLotChoiceKind; reserve: string | null };

export function unsoldFollowUpPlan(choice: {
  decidedChoice: UnsoldLotChoiceKind | null;
  decidedReserve: string | null;
}): UnsoldFollowUpPlan | null {
  if (!choice.decidedChoice) return null;
  return {
    kind: choice.decidedChoice,
    // Only a relist carries a reserve; the others never apply one.
    reserve:
      choice.decidedChoice === "relist" && hasConfiguredReserve(choice.decidedReserve)
        ? choice.decidedReserve
        : null,
  };
}

/** Which kinds staff finish by hand; a relist finishes itself when the lot returns to inventory. */
const FINISHED_BY_STAFF: Readonly<Record<UnsoldLotChoiceKind, boolean>> = {
  relist: false,
  collect: true,
  private_sale: true,
};

export function unsoldFollowUpFinishedByStaff(kind: UnsoldLotChoiceKind): boolean {
  return FINISHED_BY_STAFF[kind];
}

/** The reserve to put on the lot when it returns to inventory; `null` when there is none to apply. */
export function relistReserveToApply(followUp: {
  kind: UnsoldLotChoiceKind;
  status: UnsoldFollowUpStatus;
  reserve: string | null;
  reserveAppliedAt: Date | null;
}): string | null {
  if (followUp.kind !== "relist" || followUp.status !== "open" || followUp.reserveAppliedAt) {
    return null;
  }
  return hasConfiguredReserve(followUp.reserve) ? followUp.reserve : null;
}

/** Shown to staff who try to relist a lot the seller asked to have returned. */
export const LOT_CONFIRMED_FOR_RETURN_MESSAGE =
  "This lot is confirmed for return to its seller, so it cannot be relisted. Arrange the return from the consignment instead.";
