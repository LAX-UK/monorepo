export function formatArtistLotsLabel(lotCount: number): string {
  return lotCount === 1 ? "1 lot" : `${lotCount} lots`;
}
