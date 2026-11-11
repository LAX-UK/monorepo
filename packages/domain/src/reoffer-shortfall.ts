/**
 * What the defaulted sale would have earned beyond the re-offer, for staff only: the drop in
 * hammer plus the buyer's premium lost on the original sale. Nothing is charged; it is recorded.
 * All amounts are whole pence.
 */
export type ClaimableShortfall = {
  hammerDifferenceMinor: number;
  premiumLostMinor: number;
  totalMinor: number;
};

export function claimableShortfall(input: {
  originalHammerMinor: number;
  newHammerMinor: number;
  originalPremiumMinor: number;
}): ClaimableShortfall {
  for (const amount of Object.values(input)) {
    if (!Number.isSafeInteger(amount)) throw new RangeError("Amounts are whole pence");
  }
  const hammerDifferenceMinor = Math.max(0, input.originalHammerMinor - input.newHammerMinor);
  const premiumLostMinor = Math.max(0, input.originalPremiumMinor);
  return {
    hammerDifferenceMinor,
    premiumLostMinor,
    totalMinor: hammerDifferenceMinor + premiumLostMinor,
  };
}
