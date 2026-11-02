/**
 * What the card says the house holds for the artist: "3 lots" when anything is listed, otherwise
 * "2 results" for sold work; null when there is neither.
 */
export function artistCardCaption(input: { lotCount: number; resultCount: number }): string | null {
  if (input.lotCount > 0) return `${input.lotCount} ${input.lotCount === 1 ? "lot" : "lots"}`;
  if (input.resultCount > 0) {
    return `${input.resultCount} ${input.resultCount === 1 ? "result" : "results"}`;
  }
  return null;
}
