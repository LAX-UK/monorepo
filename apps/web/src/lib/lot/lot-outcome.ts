/**
 * What the hammer decided for an ended lot. Detail payloads carry `winnerId`; list payloads hide
 * the buyer and carry only `hasWinner`. Every view reads the outcome here so a lot is never Sold
 * in one place and Unsold in another.
 */
export type LotOutcomeSource = {
  winnerId?: string | null | undefined;
  hasWinner?: boolean | undefined;
  /** Ended, but the winner did not pay and the lot is being offered on: no result to show yet. */
  resultPending?: boolean | undefined;
};

export type LotOutcome = "sold" | "unsold" | "pending" | "unknown";

export function lotWasSold(source: LotOutcomeSource | undefined): boolean {
  if (source?.resultPending === true) return false;
  return source?.winnerId != null || source?.hasWinner === true;
}

export function lotOutcome(source: LotOutcomeSource | undefined): LotOutcome {
  if (source?.resultPending === true) return "pending";
  if (lotWasSold(source)) return "sold";
  if (source?.winnerId === null || source?.hasWinner === false) return "unsold";
  return "unknown";
}
