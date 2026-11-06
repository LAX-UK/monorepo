import { isCatalogueArtworkSoldOut } from "@/lib/catalogue/catalogue-artwork-card.vm";
import { isNewRelease } from "@/lib/catalogue/edition-release";
import {
  type EditionWorkGroup,
  editionGroupSlug,
  groupEditionVersions,
} from "@/lib/catalogue/edition-work-group";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";

/** The id of the sold-out alert on an edition page, so a card can link straight to it. */
export const EDITION_ALERT_ANCHOR = "edition-alert";

/**
 * A card states one status at most. Sold out wins over new: a sold-out release is no longer
 * something to buy, so it shows the alert instead.
 */
export type EditionCardStatus =
  | { kind: "new"; label: string }
  | { kind: "sold_out"; label: string; alertLabel: string; alertHref: string };

export type EditionCardVm = {
  slug: string;
  href: string;
  title: string;
  artistName: string;
  /** "Editions by {artist}" on Shop. */
  artistHref: string;
  imageUrl: string | null;
  imageAlt: string;
  /** "Giclée print · Edition of 30 · Hand-signed": one line, from the lead version. */
  factsLine: string | null;
  /** "£340", or "From £95 · 3 versions"; null when sold out (the status takes its place) or unpriced. */
  priceLabel: string | null;
  /** How many versions of the work the card stands for. */
  versionCount: number;
  status: EditionCardStatus | null;
};

function editionHref(slug: string): string {
  return `/artworks/${encodeURIComponent(slug)}`;
}

/** "Limited edition of 30" reads as "Edition of 30" beside the technique. */
function editionPart(line: string): string {
  return line.replace(/^limited edition/i, "Edition");
}

/**
 * The one facts line: technique, then the run, then how it is signed, each once. The run line
 * shop-domain writes ("Limited edition of 30 · Hand-signed") already holds the run's size, so the
 * size is not added again.
 */
export function editionFactsLine(item: PublicArtworkSummary): string | null {
  const runLine = item.editionCardLine?.trim();
  const parts = [
    item.medium?.trim() || null,
    ...(runLine
      ? runLine.split(" · ").map((part, index) => (index === 0 ? editionPart(part) : part))
      : [
          item.availability.totalEditions > 0
            ? `Edition of ${item.availability.totalEditions}`
            : null,
        ]),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function resolveEditionCardStatus(
  item: PublicArtworkSummary,
  now: Date,
): EditionCardStatus | null {
  return resolveWorkStatus([item], now, item.slug);
}

function resolveWorkStatus(
  versions: readonly PublicArtworkSummary[],
  now: Date,
  alertSlug: string,
): EditionCardStatus | null {
  if (versions.every(isCatalogueArtworkSoldOut)) {
    return {
      kind: "sold_out",
      label: "Sold out",
      alertLabel: "Get alerts",
      alertHref: `${editionHref(alertSlug)}#${EDITION_ALERT_ANCHOR}`,
    };
  }
  if (versions.some((item) => isNewRelease(item.listedAt, now)))
    return { kind: "new", label: "New" };
  return null;
}

function priceLabelFor(group: EditionWorkGroup): string | null {
  if (group.soldOut || group.fromPricePence === null) return null;
  const price = formatGbpPenceForDisplay(group.fromPricePence);
  return group.versions.length > 1 ? `From ${price} · ${group.versions.length} versions` : price;
}

/**
 * The Shop product card for one work: artist, title, one facts line (the cheapest version's) and
 * the price, "From £95 · 3 versions" when the work has several. It leads to the work's page,
 * where the buyer picks the version.
 */
export function toWorkCardVm(group: EditionWorkGroup, now: Date): EditionCardVm {
  const { lead } = group;
  const slug = editionGroupSlug(group);
  return {
    slug,
    href: editionHref(slug),
    title: lead.title,
    artistName: lead.artistName,
    artistHref: `/artists/${encodeURIComponent(lead.artistSlug)}`,
    imageUrl: lead.imageUrl,
    imageAlt: `${lead.title} by ${lead.artistName}`,
    factsLine: editionFactsLine(lead),
    priceLabel: priceLabelFor(group),
    versionCount: group.versions.length,
    status: resolveWorkStatus(group.versions, now, slug),
  };
}

/** The card for a single edition (one version). */
export function toEditionCardVm(item: PublicArtworkSummary, now: Date): EditionCardVm {
  return toWorkCardVm(groupEditionVersions([item])[0] as EditionWorkGroup, now);
}

/** One card per work: versions of a work are folded into the card of the work. */
export function buildEditionCards(
  items: readonly PublicArtworkSummary[],
  now: Date,
): EditionCardVm[] {
  return groupEditionVersions(items).map((group) => toWorkCardVm(group, now));
}
