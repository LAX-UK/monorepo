/** "1 edition", "12 editions". */
export function editionsLabel(count: number): string {
  return count === 1 ? "1 edition" : `${count} editions`;
}

/** The artists with editions, as the count line names them; three or more by number. */
function byArtists(artistNames: readonly string[]): string | null {
  if (artistNames.length === 0) return null;
  if (artistNames.length === 1) return artistNames[0] ?? null;
  if (artistNames.length === 2) return `${artistNames[0]} and ${artistNames[1]}`;
  return `${artistNames.length} artists`;
}

export type CatalogueCountLineInput = {
  /** Editions the current filters give. */
  resultCount: number;
  /** Every edition in the catalogue; null when its count did not load. */
  catalogueTotal: number | null;
  filtered: boolean;
  /** Names of the artists with editions in the whole catalogue. */
  artistNames: readonly string[];
};

const VAT_NOTE = "Prices include VAT.";

/**
 * The line under the title: "4 editions by Flora Powers. Prices include VAT.", or with three or
 * more artists "12 editions by 5 artists. …". With filters it gives the share: "3 of 12 editions."
 */
export function catalogueCountLine({
  resultCount,
  catalogueTotal,
  filtered,
  artistNames,
}: CatalogueCountLineInput): string {
  if (!filtered && resultCount === 0) return "No editions on sale at the moment.";
  if (filtered) {
    const share =
      catalogueTotal !== null && catalogueTotal > 0
        ? `${resultCount} of ${editionsLabel(catalogueTotal)}`
        : editionsLabel(resultCount);
    return `${share}. ${VAT_NOTE}`;
  }
  const by = byArtists(artistNames);
  return `${editionsLabel(resultCount)}${by ? ` by ${by}` : ""}. ${VAT_NOTE}`;
}
