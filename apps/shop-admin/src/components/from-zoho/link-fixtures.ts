import type {
  AdminZohoLinkCandidate,
  AdminZohoLinkComparison,
  AdminZohoLinkReport,
  AdminZohoLinkRow,
  AdminZohoLinkedRow,
} from "@auction/shop-contracts";

/** Report rows for the Link lax.art component tests. */

export const idOf = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Every field the same on both sides. */
export const SAME: AdminZohoLinkComparison[] = [
  {
    field: "title",
    label: "Title",
    laxArtValue: "Tidal margin IV",
    zohoValue: "Tidal margin IV",
    changes: false,
  },
  {
    field: "artist",
    label: "Artist",
    laxArtValue: "Ada Rowe",
    zohoValue: "Ada Rowe",
    changes: false,
  },
  {
    field: "size",
    label: "Size",
    laxArtValue: "90 × 120 cm",
    zohoValue: "90 × 120 cm",
    changes: false,
  },
];

/** Title and year change; artist and size stay. */
export const DIFFERENT: AdminZohoLinkComparison[] = [
  {
    field: "title",
    label: "Title",
    laxArtValue: "Tidal Margin 4",
    zohoValue: "Tidal margin IV",
    changes: true,
  },
  {
    field: "artist",
    label: "Artist",
    laxArtValue: "Ada Rowe",
    zohoValue: "Ada Rowe",
    changes: false,
  },
  {
    field: "size",
    label: "Size",
    laxArtValue: "90 × 120 cm",
    zohoValue: "90 × 120 cm",
    changes: false,
  },
  { field: "year", label: "Year", laxArtValue: "2023", zohoValue: "2024", changes: true },
];

const differencesOf = (comparison: readonly AdminZohoLinkComparison[]) =>
  comparison
    .filter((entry) => entry.changes)
    .map(({ field, label, laxArtValue, zohoValue }) => ({ field, label, laxArtValue, zohoValue }));

export function candidate(
  n: number,
  {
    record: recordPatch,
    ...patch
  }: Omit<Partial<AdminZohoLinkCandidate>, "record"> & {
    record?: Partial<AdminZohoLinkCandidate["record"]>;
  } = {},
): AdminZohoLinkCandidate {
  const comparison = patch.comparison ?? SAME;
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
      linkedTo: null,
      imageUrl: null,
      ...recordPatch,
    },
    differences: differencesOf(comparison),
    comparison,
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
      imageUrl: null,
      ...listing,
    },
    candidates: [candidate(n)],
    rule: "artist_and_title",
    reason: null,
    ...patch,
  };
}

export function linkedRow(n: number, patch: Partial<AdminZohoLinkedRow> = {}): AdminZohoLinkedRow {
  return {
    listing: {
      artworkId: idOf(n),
      slug: `work-${n}`,
      title: `lax.art work ${n}`,
      artistName: "Ada Rowe",
      published: true,
      imageUrl: null,
    },
    record: {
      registerId: idOf(1000 + n),
      stockCode: `LAX-ORI-AR-TM-26-${String(n).padStart(4, "0")}`,
      title: `Zoho title ${n}`,
    },
    linkedAt: "2026-11-05T10:30:00.000Z",
    linkedBy: "Lena Hart",
    ...patch,
  };
}

export function report(patch: Partial<AdminZohoLinkReport> = {}): AdminZohoLinkReport {
  const matched = patch.matched ?? [];
  const needsChoice = patch.needsChoice ?? [];
  const noMatch = patch.noMatch ?? [];
  const linked = patch.linked ?? [];
  return {
    checkedAt: "2026-11-05T09:00:00.000Z",
    counts: {
      unlinked: matched.length + needsChoice.length + noMatch.length,
      matched: matched.length,
      needsChoice: needsChoice.length,
      noMatch: noMatch.length,
      linked: linked.length,
    },
    matched,
    needsChoice,
    noMatch,
    linked,
    blockUnlinkedPublish: false,
    ...patch,
  };
}
