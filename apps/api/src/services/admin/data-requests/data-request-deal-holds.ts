/** Why a private sale deal is keeping one person's records, as staff see it on a data request. */
export type DataRequestDealHold = {
  /** What staff quote (PS-0012). */
  dealReference: string;
  /**
   * `open`: kept until the deal ends. `running`: the deal ended and the retention is running.
   * `end_unknown`: the deal's end is not recorded, so there is no end date yet.
   */
  status: "open" | "running" | "end_unknown";
  /** When the hold ends, as an ISO date-time; `null` when it has no end date yet. */
  heldUntil: string | null;
};

/**
 * The private sale deals that keep a person's enquiries and KYC evidence from erasure, so a request
 * to erase can say which deal and until when, instead of only that something is held.
 */
export interface IDataRequestDealHolds {
  forAccount(subjectId: string): Promise<DataRequestDealHold[]>;
}
