import { type PublicArtistDirectoryRow, isOrganisationKind } from "@auction/types";

export type DirectoryRowGroup = {
  id: "people" | "organisations";
  /** Heading for the group; null when the list is not split. */
  heading: string | null;
  rows: PublicArtistDirectoryRow[];
};

const HEADINGS: Record<DirectoryRowGroup["id"], string> = {
  people: "Artists",
  organisations: "Makers and brands",
};

/**
 * Splits directory rows into people and organisations (makers, brands, marques, mints), using the
 * kind's own lifespan mode so a new kind needs no change here. A list that holds only one of the
 * two stays one group without a heading.
 */
export function groupDirectoryRows(rows: PublicArtistDirectoryRow[]): DirectoryRowGroup[] {
  const people: PublicArtistDirectoryRow[] = [];
  const organisations: PublicArtistDirectoryRow[] = [];
  for (const row of rows) {
    (isOrganisationKind(row.kind) ? organisations : people).push(row);
  }
  if (rows.length === 0) return [];
  if (people.length === 0 || organisations.length === 0) {
    return [{ id: people.length > 0 ? "people" : "organisations", heading: null, rows }];
  }
  return [
    { id: "people", heading: HEADINGS.people, rows: people },
    { id: "organisations", heading: HEADINGS.organisations, rows: organisations },
  ];
}
