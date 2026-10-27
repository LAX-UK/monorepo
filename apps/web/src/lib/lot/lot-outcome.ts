/**
 * What the hammer decided for an ended lot. Detail payloads carry `winnerId`; list payloads hide
 * the buyer and carry only `hasWinner`. Every view reads the outcome here so a lot is never Sold
 * in one place and Unsold in another.
 */
export type LotOutcomeSource = {
  winnerId?: string | null | undefined;
  hasWinner?: boolean | undefined;
};

export type LotOutcome = "sold" | "unsold" | "unknown";

export function lotWasSold(source: LotOutcomeSource | undefined): boolean {
  return source?.winnerId != null || source?.hasWinner === true;
}

export function lotOutcome(source: LotOutcomeSource | undefined): LotOutcome {
  if (lotWasSold(source)) return "sold";
  if (source?.winnerId === null || source?.hasWinner === false) return "unsold";
  return "unknown";
}
