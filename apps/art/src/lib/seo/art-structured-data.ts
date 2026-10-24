import { artistHref, artworkHref } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtEditorialStoryDetail } from "@/lib/editorial/art-editorial.types";
import { helpArticleHref, helpCategoryHref } from "@/lib/help/help.vm";
import {
  type JsonLd,
  LAX_SOCIAL_LINKS,
  SITE_BUSINESS_ADDRESS,
  SITE_COMPANY_NAME,
  breadcrumbJsonLd,
  localBusinessJsonLd,
  organizationJsonLd,
  personJsonLd,
  websiteJsonLd,
} from "@auction/branding";
import {
  type HelpArticleDetail,
  type PublicArtistDetail,
  type PublicArtworkDetail,
  editorialBlocksPlainText,
} from "@auction/shop-contracts";

export const ART_SITE_NAME = "LAX Art";
const ART_SITE_DESCRIPTION =
  "London Art Exchange gallery: original paintings, prints and sculpture from emerging and established artists.";
const SCHEMA = "https://schema.org";

const OBJECT_TYPE_ARTFORM: Record<NonNullable<PublicArtworkDetail["objectType"]>, string> = {
  painting: "Painting",
  work_on_paper: "Work on paper",
  sculpture: "Sculpture",
  photography: "Photography",
  print: "Print",
  mixed_media: "Mixed media",
};

function absolute(siteUrl: URL, pathOrUrl: string): string {
  return new URL(pathOrUrl, siteUrl).toString();
}

function centimetres(value: number | null | undefined): JsonLd | undefined {
  return value ? { "@type": "QuantitativeValue", value, unitCode: "CMT" } : undefined;
}

function compact(record: Record<string, unknown>): JsonLd {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value != null));
}

function breadcrumbs(siteUrl: URL, items: { name: string; path: string }[]): JsonLd {
  return breadcrumbJsonLd(siteUrl.origin, [{ name: ART_SITE_NAME, path: "/" }, ...items]);
}

/** Root-layout graph: the gallery as organisation and place, plus site search. */
export function artSiteJsonLd(siteUrl: URL): JsonLd[] {
  const url = siteUrl.origin;
  const logo = absolute(siteUrl, "/brand/lax-logo.svg");
  const shared = {
    name: ART_SITE_NAME,
    alternateName: [SITE_COMPANY_NAME],
    url,
    description: ART_SITE_DESCRIPTION,
    logo,
    address: SITE_BUSINESS_ADDRESS,
    sameAs: Object.values(LAX_SOCIAL_LINKS),
  };
  return [
    organizationJsonLd(shared),
    localBusinessJsonLd({ ...shared, type: "ArtGallery", image: logo }),
    websiteJsonLd({
      name: ART_SITE_NAME,
      url,
      description: ART_SITE_DESCRIPTION,
      searchUrlTemplate: `${url}/artworks?q={search_term_string}`,
    }),
  ];
}

function artworkOffer(artwork: PublicArtworkDetail, url: string): JsonLd | undefined {
  if (!artwork.eligibleForEditionAllocation || artwork.printPricePence == null) return undefined;
  const soldOut = artwork.saleState === "sold" || artwork.availability.state === "sold_out";
  return {
    "@type": "Offer",
    url,
    price: (artwork.printPricePence / 100).toFixed(2),
    priceCurrency: "GBP",
    availability: `${SCHEMA}/${soldOut ? "SoldOut" : "InStock"}`,
    seller: { "@type": "Organization", name: ART_SITE_NAME },
  };
}

/** VisualArtwork (with an Offer when a public price exists) and its breadcrumb trail. */
export function artworkJsonLd(artwork: PublicArtworkDetail, siteUrl: URL): JsonLd[] {
  const path = artworkHref(artwork.slug);
  const url = absolute(siteUrl, path);
  const images = [
    ...new Set(
      [...(artwork.images ?? []).map((image) => image.url), artwork.imageUrl]
        .filter((image): image is string => Boolean(image))
        .map((image) => absolute(siteUrl, image)),
    ),
  ];
  return [
    compact({
      "@context": SCHEMA,
      "@type": "VisualArtwork",
      "@id": `${url}#artwork`,
      name: artwork.title,
      url,
      image: images.length > 0 ? images : undefined,
      description: artwork.description ?? undefined,
      creator: {
        "@type": "Person",
        name: artwork.artistName,
        url: absolute(siteUrl, artistHref(artwork.artistSlug)),
      },
      artform: artwork.objectType ? OBJECT_TYPE_ARTFORM[artwork.objectType] : undefined,
      artMedium: artwork.medium ?? undefined,
      dateCreated: artwork.yearCreated ? String(artwork.yearCreated) : undefined,
      height: centimetres(artwork.heightCm),
      width: centimetres(artwork.widthCm),
      depth: centimetres(artwork.depthCm),
      offers: artworkOffer(artwork, url),
    }),
    breadcrumbs(siteUrl, [
      { name: "Artworks", path: "/artworks" },
      { name: artwork.title, path },
    ]),
  ];
}

export function artistJsonLd(artist: PublicArtistDetail, siteUrl: URL): JsonLd[] {
  const path = artistHref(artist.slug);
  const description = artist.shortBio ?? artist.bio;
  return [
    personJsonLd({
      name: artist.name,
      url: absolute(siteUrl, path),
      ...(artist.portraitUrl ? { image: absolute(siteUrl, artist.portraitUrl) } : {}),
      ...(description ? { description } : {}),
      ...(artist.discipline ? { jobTitle: artist.discipline } : {}),
    }),
    breadcrumbs(siteUrl, [
      { name: "Artists", path: "/artists" },
      { name: artist.name, path },
    ]),
  ];
}

export function storyJsonLd(story: ArtEditorialStoryDetail, siteUrl: URL): JsonLd[] {
  const path = `/stories/${encodeURIComponent(story.slug)}`;
  const publisher = {
    "@type": "Organization",
    name: ART_SITE_NAME,
    logo: { "@type": "ImageObject", url: absolute(siteUrl, "/brand/lax-logo.svg") },
  };
  return [
    compact({
      "@context": SCHEMA,
      "@type": "Article",
      headline: story.title.slice(0, 110),
      url: absolute(siteUrl, path),
      mainEntityOfPage: absolute(siteUrl, path),
      description: story.seoDescription ?? story.standfirst ?? undefined,
      image: story.coverUrl ? [absolute(siteUrl, story.coverUrl)] : undefined,
      author: { "@type": "Organization", name: ART_SITE_NAME, url: siteUrl.origin },
      publisher,
    }),
    breadcrumbs(siteUrl, [
      { name: "Art Hub", path: "/art-hub" },
      { name: story.title, path },
    ]),
  ];
}

/**
 * One answer is one FAQPage: Google shows a question and its answer together, and a page that
 * answers exactly one question is the shape it expects. The answer text is the prose of the
 * blocks, so it matches what the page shows.
 */
export function helpArticleJsonLd(article: HelpArticleDetail, siteUrl: URL): JsonLd[] {
  const path = helpArticleHref(article.slug);
  return [
    {
      "@context": SCHEMA,
      "@type": "FAQPage",
      url: absolute(siteUrl, path),
      mainEntity: [
        {
          "@type": "Question",
          name: article.question,
          acceptedAnswer: { "@type": "Answer", text: editorialBlocksPlainText(article.answer) },
        },
      ],
    },
    breadcrumbs(siteUrl, [
      { name: "Help centre", path: "/help" },
      { name: article.categoryTitle, path: helpCategoryHref(article.categorySlug) },
      { name: article.question, path },
    ]),
  ];
}
