export type EditionPickCandidate = {
  editionNumber: number;
  saleAuthorisedAt: Date | null;
};

/** First authorised (earliest grant time), then lowest edition number. */
export function compareEditionPickOrder(a: EditionPickCandidate, b: EditionPickCandidate): number {
  const aTime = a.saleAuthorisedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bTime = b.saleAuthorisedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return a.editionNumber - b.editionNumber;
}
