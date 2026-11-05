import type {
  AdminZohoLinkCandidate,
  AdminZohoLinkReport,
  AdminZohoLinkRow,
} from "@auction/shop-contracts";

/** Report rows for the Link lax.art component tests. */

export const idOf = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export function candidate(
  n: number,
  patch: Partial<AdminZohoLinkCandidate> = {},
): AdminZohoLinkCandidate {
  return {
    record: {
      registerId: idOf(1000 + n),
      stockCode: `LAX-ORI-AR-TM-26-${String(n).padStart(4, "0")}`,
      title: `Zoho title ${n}`,
      artistName: "Ada Rowe",
      artistCode: "AR",
      dimensions: "90 × 120 cm",
      year: 2024,
      zohoStatus: "Available",
      whereItIs: "Not offered",
    },
    differences: [],
    refusal: null,
    ...patch,
  };
}

export function row(
  n: number,
  patch: Partial<AdminZohoLinkRow> = {},
  listing: Partial<AdminZohoLinkRow["listing"]> = {},
): AdminZohoLinkRow {
  return {
    listing: {
      artworkId: idOf(n),
      slug: `work-${n}`,
      title: `lax.art work ${n}`,
      artistName: "Ada Rowe",
      artistCode: "AR",
      stockCode: null,
      dimensions: null,
      year: null,
      published: true,
      ...listing,
    },
    candidates: [candidate(n)],
    rule: "artist_and_title",
    reason: null,
    ...patch,
  };
}

export function report(patch: Partial<AdminZohoLinkReport> = {}): AdminZohoLinkReport {
  const matched = patch.matched ?? [];
  const needsChoice = patch.needsChoice ?? [];
  const noMatch = patch.noMatch ?? [];
  return {
    checkedAt: "2026-11-05T09:00:00.000Z",
    counts: {
      unlinked: matched.length + needsChoice.length + noMatch.length,
      matched: matched.length,
      needsChoice: needsChoice.length,
      noMatch: noMatch.length,
    },
    matched,
    needsChoice,
    noMatch,
    blockUnlinkedPublish: false,
    ...patch,
  };
}

export const DIFFERENT = [
  { field: "title", label: "Title", zohoValue: "Tidal margin IV", laxArtValue: "Tidal Margin 4" },
  { field: "year", label: "Year", zohoValue: "2024", laxArtValue: "2023" },
] as const;
