import type {
  AdminZohoLinkBody,
  AdminZohoLinkCandidate,
  AdminZohoLinkOutcome,
  AdminZohoLinkReport,
  AdminZohoLinkRow,
} from "@auction/shop-contracts";

export type LinkRule = NonNullable<AdminZohoLinkRow["rule"]>;
export type NoMatchReason = NonNullable<AdminZohoLinkRow["reason"]>;

/** Why Matched rows were matched, in words for staff. */
export const LINK_RULE_LABEL: Record<LinkRule, string> = {
  stock_code: "Same stock code",
  artist_and_title: "Same artist and title",
  artist_title_and_size: "Same artist, title and size",
  artist_title_and_year: "Same artist, title and year",
};

/** Why a row has no match, and what staff can do about it. */
export const NO_MATCH_REASON_LABEL: Record<NoMatchReason, string> = {
  stock_code_unknown: "The stock code on lax.art is not in Zoho",
  artist_has_no_zoho_code:
    "The artist has no Zoho artist code, and a title alone is never enough to match",
  no_record_for_artist_and_title: "No Zoho record has this artist and title",
};

export const LINK_GROUPS = [
  { id: "matched", label: "Matched" },
  { id: "needsChoice", label: "Needs a choice" },
  { id: "noMatch", label: "No match" },
] as const;

/** The rows a bulk confirmation would link, and the matched rows it would leave out and why. */
export function planBulkLink(matched: readonly AdminZohoLinkRow[]) {
  const linkable: Array<{ row: AdminZohoLinkRow; candidate: AdminZohoLinkCandidate }> = [];
  const refused: Array<{ row: AdminZohoLinkRow; candidate: AdminZohoLinkCandidate }> = [];
  for (const row of matched) {
    const candidate = row.candidates[0];
    if (!candidate) continue;
    (candidate.refusal ? refused : linkable).push({ row, candidate });
  }
  return {
    linkable,
    refused,
    withDifferences: linkable.filter((item) => item.candidate.differences.length > 0).length,
    links: linkable.map(
      (item): AdminZohoLinkBody => ({
        artworkId: item.row.listing.artworkId,
        registerId: item.candidate.record.registerId,
      }),
    ),
  };
}

/** How many of each outcome a bulk link had. */
export function summariseOutcomes(outcomes: readonly AdminZohoLinkOutcome[]) {
  const count = (status: AdminZohoLinkOutcome["status"]) =>
    outcomes.filter((outcome) => outcome.status === status).length;
  return {
    linked: count("linked"),
    alreadyLinked: count("already_linked"),
    refused: count("refused"),
    notAMatch: count("not_a_match"),
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "12 linked. 1 refused." as one line for the result of a bulk link. */
export function outcomeSentence(outcomes: readonly AdminZohoLinkOutcome[]): string {
  const sum = summariseOutcomes(outcomes);
  const parts = [
    plural(sum.linked, "artwork linked", "artworks linked"),
    ...(sum.alreadyLinked > 0 ? [`${sum.alreadyLinked} already linked`] : []),
    ...(sum.refused > 0 ? [`${sum.refused} refused`] : []),
    ...(sum.notAMatch > 0 ? [`${sum.notAMatch} no longer a match`] : []),
  ];
  return `${parts.join(", ")}.`;
}

/** The rows of the report in the order the groups are shown, with their counts. */
export function groupRows(report: AdminZohoLinkReport) {
  return [
    { ...LINK_GROUPS[0], rows: report.matched },
    { ...LINK_GROUPS[1], rows: report.needsChoice },
    { ...LINK_GROUPS[2], rows: report.noMatch },
  ];
}

/** Zoho's value for a difference as shown; an empty value is said so. */
export const differenceValue = (value: string | null) => value ?? "Empty";
