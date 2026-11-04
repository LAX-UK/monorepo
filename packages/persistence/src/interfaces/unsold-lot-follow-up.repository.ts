import type { Database } from "@auction/db";
import type { UnsoldLotFollowUp } from "@auction/types";
import type { UnsoldLotOutcomeKey } from "./unsold-lot-choice.repository.js";

/** Opens the staff work for a choice a specialist confirmed. Used by the worker. */
export interface IUnsoldFollowUpStore {
  /**
   * Opens the work for the confirmed choice of the lot's current unsold outcome, once per choice;
   * a repeat returns the work already open. `null` when there is nothing to open (no confirmed
   * choice for the outcome the lot is in).
   */
  openForConfirmedChoice(submissionId: string, lotId: string): Promise<UnsoldLotFollowUp | null>;
}

export interface IUnsoldFollowUpReader {
  findForOutcome(key: UnsoldLotOutcomeKey): Promise<UnsoldLotFollowUp | null>;
}

export interface IUnsoldFollowUpWriter {
  /**
   * Marks the return or private-sale work done. `null` when there is none open for the outcome;
   * a relist is not finished this way, it finishes when the lot returns to inventory.
   */
  completeByStaff(
    key: UnsoldLotOutcomeKey,
    staffUserId: string,
    at: Date,
  ): Promise<UnsoldLotFollowUp | null>;
}

/** What returning the lot to inventory did with the agreed reserve. */
export type RelistReserveSettlement = {
  followUpId: string;
  /** The reserve the lot had before; `null` when it had none. */
  previousReserve: string | null;
  /** The reserve put on the lot; `null` when the choice kept the reserve it ended with. */
  appliedReserve: string | null;
};

/** Runs inside the transaction that returns a lot to inventory. */
export interface IRelistReserveSettlement {
  /**
   * Finishes the open relist for the outcome and puts its agreed reserve on the lot. The work is
   * closed in the same statement that reads it, so the reserve is applied once. `null` when no
   * relist is open for the outcome.
   */
  settleOnReturn(
    tx: Database,
    key: UnsoldLotOutcomeKey,
    staffUserId: string,
    at: Date,
  ): Promise<RelistReserveSettlement | null>;
}
