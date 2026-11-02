import type { WithdrawnCatalogueRow } from "@/lib/data/http/sales.types";
import type { SaleroomCatalogSort } from "@/lib/marketing/saleroom-catalog-sort";

/** A withdrawn lot as the catalogue shows it: the number and the title. */
export type WithdrawnRowVM = {
  id: string;
  lotNumber: number | null;
  /** "Lot 3". */
  lotLabel: string | null;
  title: string;
};

/** One entry of the catalogue, in the order it is shown. */
export type CatalogueRow<Lot extends { id: string }> =
  | { kind: "lot"; key: string; lot: Lot }
  | { kind: "withdrawn"; key: string; row: WithdrawnRowVM };

export function toWithdrawnRowVM(row: WithdrawnCatalogueRow): WithdrawnRowVM {
  return {
    id: row.id,
    lotNumber: row.lotNumber,
    lotLabel: row.lotNumber != null ? `Lot ${row.lotNumber}` : null,
    title: row.title,
  };
}

/**
 * Withdrawn lots stay in the lot-order catalogue at their number, like a printed catalogue. They
 * have no price or close to sort by, so on every other sort they come last (the server pins them
 * there too).
 */
export function withdrawnRowsFor(
  rows: readonly WithdrawnCatalogueRow[],
  narrowing: { statusFilter: string | null; catalogSearch: string },
): WithdrawnRowVM[] {
  // A status chip names a lot's state; a withdrawn lot has none of them.
  if (narrowing.statusFilter) return [];
  const needle = narrowing.catalogSearch.trim().toLowerCase();
  return rows
    .filter((row) => !needle || row.title.toLowerCase().includes(needle))
    .map(toWithdrawnRowVM);
}

function numberOf(lot: { lotNumber?: number | null | undefined }): number {
  return lot.lotNumber ?? Number.MAX_SAFE_INTEGER;
}

export function mergeCatalogueRows<Lot extends { id: string; lotNumber?: number | null }>(
  lots: readonly Lot[],
  withdrawn: readonly WithdrawnRowVM[],
  sort: SaleroomCatalogSort,
): CatalogueRow<Lot>[] {
  const lotRows: CatalogueRow<Lot>[] = lots.map((lot) => ({ kind: "lot", key: lot.id, lot }));
  const orderedWithdrawn = [...withdrawn].sort((a, b) => numberOf(a) - numberOf(b));
  const withdrawnRows: CatalogueRow<Lot>[] = orderedWithdrawn.map((row) => ({
    kind: "withdrawn",
    key: row.id,
    row,
  }));
  if (sort !== "lot") return [...lotRows, ...withdrawnRows];

  const merged: CatalogueRow<Lot>[] = [];
  let w = 0;
  for (const entry of lotRows) {
    const lotNo = entry.kind === "lot" ? numberOf(entry.lot) : 0;
    while (w < withdrawnRows.length) {
      const next = withdrawnRows[w];
      if (!next || next.kind !== "withdrawn" || numberOf(next.row) >= lotNo) break;
      merged.push(next);
      w += 1;
    }
    merged.push(entry);
  }
  return [...merged, ...withdrawnRows.slice(w)];
}
