import type {
  AdminZohoLinkBody,
  AdminZohoLinkCandidate,
  AdminZohoLinkComparison,
  AdminZohoLinkOutcome,
  AdminZohoLinkRow,
} from "@auction/shop-contracts";
import type { ChangesRow } from "@auction/staff-ui";

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

/** The table rows of a before and after comparison, as the kit's table draws them. */
export function changeRows(comparison: readonly AdminZohoLinkComparison[]): ChangesRow[] {
  return comparison.map((row) => ({
    id: row.field,
    label: row.label,
    before: row.laxArtValue,
    after: row.zohoValue,
    changes: row.changes,
  }));
}

/** "Title and size", "title, size and year": field names as a sentence fragment. */
export function joinFields(labels: readonly string[]): string {
  const lower = labels.map((label) => label.toLowerCase());
  if (lower.length <= 1) return lower.join("");
  return `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
}

/** The line under one link's table: what changes, that the web address stays, and where it goes. */
export function linkFootnote(input: {
  comparison: readonly AdminZohoLinkComparison[];
  published: boolean | null;
  whereItIs: string;
}): string {
  const changed = input.comparison.filter((row) => row.changes).length;
  const first =
    changed === 0
      ? "lax.art and Zoho already agree."
      : `${changed} ${changed === 1 ? "field changes" : "fields change"} to Zoho's values.`;
  const place =
    input.published === true
      ? input.whereItIs === "Not offered"
        ? "It becomes On lax.art in the register."
        : "It is live on lax.art."
      : input.published === false
        ? "It stays a draft. The register shows it as On lax.art when it is published."
        : "";
  return [first, "The web address stays the same.", place].filter(Boolean).join(" ");
}

/** What a bulk link will do, in the three lines of its confirmation. */
export function bulkSummary(plan: ReturnType<typeof planBulkLink>) {
  const changed = plan.linkable
    .filter((item) => item.candidate.differences.length > 0)
    .map((item) => ({
      row: item.row,
      candidate: item.candidate,
      fields: joinFields(item.candidate.differences.map((difference) => difference.label)),
    }));
  const live = plan.linkable.filter((item) => item.row.listing.published).length;
  return { linked: plan.linkable.length, changed, live, drafts: plan.linkable.length - live };
}
