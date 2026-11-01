import type { LotStatus } from "@auction/types";

/** Lot states in which a catalogue card still invites a bid. */
const BIDDABLE_STATUSES: ReadonlySet<LotStatus> = new Set(["draft", "scheduled", "active"]);

/**
 * Whether a catalogue card offers its Bid action. An ended, cancelled or withdrawn lot is a
 * result: its card shows the outcome, never a button for a bid that cannot be placed.
 */
export function lotShowsBidAction(status: LotStatus): boolean {
  return BIDDABLE_STATUSES.has(status);
}
