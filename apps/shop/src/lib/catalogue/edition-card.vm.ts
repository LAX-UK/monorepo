import { isCatalogueArtworkSoldOut } from "@/lib/catalogue/catalogue-artwork-card.vm";
import { isNewRelease } from "@/lib/catalogue/edition-release";
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
  /** "Giclée print · Edition of 24"; null when neither is catalogued. */
  factsLine: string | null;
  /** "£340" incl. VAT; null when sold out (the status takes its place) or not yet priced. */
  priceLabel: string | null;
  status: EditionCardStatus | null;
};

function editionHref(slug: string): string {
  return `/artworks/${encodeURIComponent(slug)}`;
}

function factsLine(item: PublicArtworkSummary): string | null {
  const parts = [
    item.medium?.trim() || null,
    item.availability.totalEditions > 0 ? `Edition of ${item.availability.totalEditions}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function resolveEditionCardStatus(
  item: PublicArtworkSummary,
  now: Date,
): EditionCardStatus | null {
  if (isCatalogueArtworkSoldOut(item)) {
    return {
      kind: "sold_out",
      label: "Sold out",
      alertLabel: "Get alerts",
      alertHref: `${editionHref(item.slug)}#${EDITION_ALERT_ANCHOR}`,
    };
  }
  if (isNewRelease(item.listedAt, now)) return { kind: "new", label: "New" };
  return null;
}

/** The Shop product card: artist first, then title, technique and edition size, then price. */
export function toEditionCardVm(item: PublicArtworkSummary, now: Date): EditionCardVm {
  const status = resolveEditionCardStatus(item, now);
  return {
    slug: item.slug,
    href: editionHref(item.slug),
    title: item.title,
    artistName: item.artistName,
    artistHref: `/artists/${encodeURIComponent(item.artistSlug)}`,
    imageUrl: item.imageUrl,
    imageAlt: `${item.title} by ${item.artistName}`,
    factsLine: factsLine(item),
    priceLabel:
      status?.kind === "sold_out" || item.printPricePence === null
        ? null
        : formatGbpPenceForDisplay(item.printPricePence),
    status,
  };
}

export function buildEditionCards(
  items: readonly PublicArtworkSummary[],
  now: Date,
): EditionCardVm[] {
  return items.map((item) => toEditionCardVm(item, now));
}
