import {
  EDITION_PAGE_COPY,
  allEditionsLabel,
  editionsByLabel,
  moreByTitle,
  oneMoreEditionLabel,
} from "@/content/artwork-edition-copy";
import {
  type ArtworkPurchaseVm,
  presentArtworkPurchase,
} from "@/lib/presenters/artwork-purchase.presenter";
import { type ArtworkScaleVm, presentArtworkScale } from "@/lib/presenters/artwork-scale.presenter";
import { artworkSizeText } from "@/lib/presenters/artwork-size.presenter";
import type {
  PublicArtistDetail,
  PublicArtworkDetail,
  PublicArtworkSummary,
} from "@auction/shop-contracts";
import {
  type PublicEditionRun,
  describeOtherRun,
  describePrintException,
  describePublicEdition,
  describeSetApartAvailable,
  setApartPrintText,
} from "@auction/shop-domain";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";

/*
 * How a Shop edition page reads: the stage, the buy column, the facts about the edition, the work
 * and the print, the artist and more by them. Everything said about the edition itself comes from
 * shop-domain's `describePublicEdition`; this file only arranges it. Pure, so it is tested without
 * rendering.
 */

export type ArtworkGalleryImageVm = { url: string; alt: string };

export type ArtworkGalleryVm = {
  images: ArtworkGalleryImageVm[];
  /** A to-scale drawing, offered after the photographs; null without a usable size. */
  scale: ArtworkScaleVm | null;
};

export type ArtworkSpecItem = { label: string; value: string };

/** "About this edition": label-value rows, what a limited edition is, other runs and the original. */
export type ArtworkFactsVm = {
  rows: ArtworkSpecItem[];
  /** What a limited edition is; limited runs only. */
  statement: string | null;
  /** Other runs of the same image, named beside this limited edition. */
  alsoAvailable: Array<{ slug: string; href: string; label: string; trailing: string | null }>;
  /** "See the original at lax.art"; only while the linked original is live there. */
  originalOnArtHref: string | null;
};

export type ArtworkAboutVm = {
  description: string | null;
  rows: ArtworkSpecItem[];
};

/** "About the artist", as on lax.art: portrait, name, a short bio and two ways on. */
export type ArtworkArtistVm = {
  name: string;
  /** Shop's "Editions by…" page. */
  href: string;
  portraitUrl: string | null;
  bio: string | null;
  editionsLabel: string;
  /** Null when lax.art is not configured here; the profile action is then hidden. */
  laxArtHref: string | null;
  laxArtLabel: string;
};

export type ArtworkMoreByVm = {
  title: string;
  items: PublicArtworkSummary[];
  /** With exactly one other edition, a text tile pairs with its card. */
  tile: { label: string; href: string } | null;
  /** With more than four, a link to all of them after the row of four. */
  allLink: { label: string; href: string } | null;
};

export type ArtworkProductPageVm = {
  slug: string;
  title: string;
  year: number | null;
  artistName: string;
  /** The artist's page on Shop: their editions. */
  artistHref: string;
  /** "Limited edition print", from the facts; null when the page has no run to describe. */
  eyebrow: string | null;
  /** "Giclée print on cotton rag · 60 × 45 cm (23.6 × 17.7 in)". */
  metaLine: string | null;
  gallery: ArtworkGalleryVm;
  /** Null when the edition has no price yet, so it cannot be bought. */
  purchase: ArtworkPurchaseVm | null;
  /** The line for the basket confirmation, from the facts. */
  basketLine: string | null;
  facts: ArtworkFactsVm | null;
  about: ArtworkAboutVm;
  artist: ArtworkArtistVm;
  /** Null when the artist has no other published edition. */
  moreBy: ArtworkMoreByVm | null;
};

/** Editions in the row; a fifth makes it "All N editions by…". */
export const MORE_BY_ROW_LIMIT = 4;

export function artworkImageAlt(artwork: Pick<PublicArtworkDetail, "title" | "artistName">) {
  return `${artwork.title} by ${artwork.artistName}`;
}

/** Every image the API returns, in order; the primary image alone for older records. */
export function buildGalleryImages(artwork: PublicArtworkDetail): ArtworkGalleryImageVm[] {
  const fallbackAlt = artworkImageAlt(artwork);
  const seen = new Set<string>();
  const images: ArtworkGalleryImageVm[] = [];
  for (const image of artwork.images ?? []) {
    if (!image.url || seen.has(image.url)) continue;
    seen.add(image.url);
    images.push({ url: image.url, alt: image.alt?.trim() || fallbackAlt });
  }
  if (images.length === 0 && artwork.imageUrl) {
    images.push({ url: artwork.imageUrl, alt: fallbackAlt });
  }
  return images;
}

/** The run behind the page: the one the API sent, or the plain size older records carry. */
function editionRun(artwork: PublicArtworkDetail): PublicEditionRun | null {
  if (artwork.edition) return artwork.edition.run;
  const size = artwork.availability.totalEditions;
  return artwork.eligibleForEditionAllocation && size > 0 ? { kind: "limited", size } : null;
}

/**
 * The artist's other editions, this page's own left out, available ones first and each group in
 * the order the API gave.
 */
export function selectMoreByEditions(
  slug: string,
  items: readonly PublicArtworkSummary[],
): PublicArtworkSummary[] {
  const others = items.filter((item) => item.slug !== slug && item.eligibleForEditionAllocation);
  return [
    ...others.filter((item) => item.availability.state === "available"),
    ...others.filter((item) => item.availability.state !== "available"),
  ];
}

export function buildMoreBy(input: {
  slug: string;
  artistName: string;
  artistHref: string;
  artistEditions: readonly PublicArtworkSummary[];
  /** All the artist's published editions, this one included, when the API counted them. */
  artistEditionCount?: number | undefined;
}): ArtworkMoreByVm | null {
  const others = selectMoreByEditions(input.slug, input.artistEditions);
  if (others.length === 0) return null;
  const total = Math.max(input.artistEditionCount ?? 0, others.length + 1);
  const title = moreByTitle(input.artistName);
  if (others.length === 1) {
    return {
      title,
      items: others,
      tile: { label: oneMoreEditionLabel(input.artistName), href: input.artistHref },
      allLink: null,
    };
  }
  if (others.length <= MORE_BY_ROW_LIMIT - 1) {
    return { title, items: others, tile: null, allLink: null };
  }
  return {
    title,
    items: others.slice(0, MORE_BY_ROW_LIMIT),
    tile: null,
    allLink: { label: allEditionsLabel(input.artistName, total), href: input.artistHref },
  };
}

function artUrl(artBaseUrl: URL | null, path: string): string | null {
  return artBaseUrl ? new URL(path, artBaseUrl).toString() : null;
}

function buildFacts(
  artwork: PublicArtworkDetail,
  originalOnArtHref: string | null,
): { eyebrow: string | null; basketLine: string | null; facts: ArtworkFactsVm | null } {
  const run = editionRun(artwork);
  if (!run) return { eyebrow: null, basketLine: null, facts: null };
  const setApart = artwork.edition?.setApart ?? null;
  const edition = describePublicEdition({
    run,
    facts: artwork.edition?.facts ?? null,
    proofsKept: artwork.edition?.proofsKept ?? null,
    setApart,
  });
  const labels = EDITION_PAGE_COPY.factLabels;
  const rows: ArtworkSpecItem[] = edition.rows
    ? [
        { label: labels.edition, value: edition.rows.edition },
        { label: labels.signature, value: edition.rows.signature },
        { label: labels.number, value: edition.rows.number },
        { label: labels.certificate, value: edition.rows.certificate },
        // Set by staff in the Edition facts card; a row appears only when it is stated.
        ...(edition.rows.stamp ? [{ label: labels.stamp, value: edition.rows.stamp }] : []),
        ...(edition.rows.printedBy
          ? [{ label: labels.printedBy, value: edition.rows.printedBy }]
          : []),
        ...(edition.rows.publishedBy
          ? [{ label: labels.publishedBy, value: edition.rows.publishedBy }]
          : []),
        ...(edition.rows.proofs ? [{ label: labels.proofs, value: edition.rows.proofs }] : []),
        // A print sold on its own says what is different about it, before it is bought.
        ...(setApart ? describePrintException(setApart.exception).items : []),
      ]
    : [{ label: labels.edition, value: edition.edition }];
  const alsoAvailable =
    run.kind === "limited"
      ? (artwork.edition?.otherRuns ?? []).map((other) => ({
          slug: other.slug,
          href: `/artworks/${encodeURIComponent(other.slug)}`,
          label: other.setApart
            ? describeSetApartAvailable(
                setApartPrintText(other.setApart.print),
                other.setApart.exception,
              )
            : describeOtherRun(other.run, other.facts),
          trailing:
            other.availability === "sold_out"
              ? EDITION_PAGE_COPY.soldOut
              : other.printPricePence === null
                ? null
                : formatGbpPenceForDisplay(other.printPricePence),
        }))
      : [];
  return {
    eyebrow: edition.eyebrow,
    basketLine: edition.basketLine ?? edition.edition,
    facts: {
      rows,
      statement: edition.statement,
      alsoAvailable,
      originalOnArtHref,
    },
  };
}

function buildAbout(artwork: PublicArtworkDetail): ArtworkAboutVm {
  const labels = EDITION_PAGE_COPY.workLabels;
  const rows: ArtworkSpecItem[] = [
    ...(artwork.medium ? [{ label: labels.medium, value: artwork.medium }] : []),
    ...(artwork.printPaper ? [{ label: labels.paper, value: artwork.printPaper }] : []),
    ...(artwork.printSize ? [{ label: labels.sheetSize, value: artwork.printSize }] : []),
  ];
  return { description: artwork.description?.trim() || null, rows };
}

/** "Giclée print on cotton rag · 60 × 45 cm (23.6 × 17.7 in)": whatever of the two is known. */
function buildMetaLine(artwork: PublicArtworkDetail): string | null {
  const material =
    artwork.medium && artwork.printPaper
      ? `${artwork.medium} on ${artwork.printPaper}`
      : (artwork.medium ?? artwork.printPaper ?? null);
  const parts = [material, artworkSizeText(artwork)].filter((part): part is string =>
    Boolean(part),
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function buildArtworkProductPage(input: {
  artwork: PublicArtworkDetail;
  /** The artist's Shop editions (may include this one). */
  artistEditions: readonly PublicArtworkSummary[];
  /** How many editions the artist has published, when the API counted them. */
  artistEditionCount?: number | undefined;
  artBaseUrl: URL | null;
  /** The artist's Shop profile, when it could be read; the block falls back to the name. */
  artistDetail?: PublicArtistDetail | null;
}): ArtworkProductPageVm {
  const { artwork, artBaseUrl } = input;
  const artistSlug = encodeURIComponent(artwork.artistSlug);
  const artistHref = `/artists/${artistSlug}`;
  const originalOnArtHref = artwork.sourceOriginalSlug
    ? artUrl(artBaseUrl, `/artworks/${encodeURIComponent(artwork.sourceOriginalSlug)}`)
    : null;
  const { eyebrow, basketLine, facts } = buildFacts(artwork, originalOnArtHref);
  const editionCount = Math.max(input.artistEditionCount ?? 0, input.artistEditions.length);
  return {
    slug: artwork.slug,
    title: artwork.title,
    year: artwork.yearCreated,
    artistName: artwork.artistName,
    artistHref,
    eyebrow,
    metaLine: buildMetaLine(artwork),
    gallery: { images: buildGalleryImages(artwork), scale: presentArtworkScale(artwork) },
    purchase: presentArtworkPurchase(artwork),
    basketLine,
    facts,
    about: buildAbout(artwork),
    artist: {
      name: artwork.artistName,
      href: artistHref,
      portraitUrl: input.artistDetail?.portraitUrl ?? null,
      bio: input.artistDetail?.shortBio?.trim() || null,
      editionsLabel: editionsByLabel(artwork.artistName, editionCount),
      laxArtHref: artUrl(artBaseUrl, artistHref),
      laxArtLabel: EDITION_PAGE_COPY.profileOnLaxArt,
    },
    moreBy: buildMoreBy({
      slug: artwork.slug,
      artistName: artwork.artistName,
      artistHref,
      artistEditions: input.artistEditions,
      artistEditionCount: input.artistEditionCount,
    }),
  };
}
