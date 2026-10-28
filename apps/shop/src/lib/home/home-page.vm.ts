import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import { SHOP_HELP_CONTACT } from "@/content/policies/help";
import { SHOP_POLICY_PATHS, type ShopPolicySlug } from "@/content/policies/shop-policy-status";
import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import { isCatalogueArtworkSoldOut } from "@/lib/catalogue/catalogue-artwork-card.vm";
import { formatReleaseDate, isNewRelease } from "@/lib/catalogue/edition-release";
import { type CheckoutDeliveryTimes, workingDaysLabel } from "@/lib/checkout/checkout-delivery";
import { type GalleryTeamVm, buildGalleryTeam } from "@/lib/gallery-team/gallery-team.vm";
import {
  type HomeCollectionVm,
  type HomeQuickFilterVm,
  MIN_COLLECTION_SIZE,
  buildHomeCollections,
  buildHomeQuickFilters,
  chooseCollectionCategories,
  choosePriceBand,
} from "@/lib/home/home-browse-paths";
import type { HomePageComposerResult, HomeSectionKey } from "@/lib/home/home-page.composer";
import { legalEntityFor } from "@auction/branding";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { MarketingProductDoorVm } from "@auction/marketing-ui";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { FULFILMENT_SURCHARGE_PENCE } from "@auction/shop-domain";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";

/** The new-editions row is one desktop row of four. */
const NEW_EDITIONS_ROW = 4;
/** An artists row needs this many to look chosen rather than missing. */
const MIN_HOME_ARTISTS = 3;
/** "by {n} gallery artists" only reads as a strength from this many. */
const MIN_ARTIST_COUNT_IN_LEAD = 3;

export type HomeReleaseVm = {
  href: string;
  imageUrl: string;
  imageAlt: string;
  artistName: string;
  /** "Harbour light, 2026". */
  titleLine: string;
  /** "£340", or "Sold out" in its place. */
  priceLabel: string | null;
  /** "Giclée print · 60 × 40 cm"; null when neither is catalogued. */
  factsLine: string | null;
  /** "Edition of 50"; null when the size is not catalogued. */
  editionLine: string | null;
};

export type HomeHeroVm = {
  /** "New release · 28 Oct 2026", "Featured edition", or null without a release. */
  eyebrow: string | null;
  title: string;
  lead: string;
  primary: { label: string; href: string };
  /** "See Harbour light", beside the primary action; null without a release. */
  workLink: { label: string; href: string } | null;
  release: HomeReleaseVm | null;
};

export type HomeTrustItemVm = {
  id: "editions" | "gallery" | "delivery" | "returns";
  title: string;
  body: string;
  link: { label: string; href: string } | null;
};

export type HomeNewEditionsVm = {
  items: PublicArtworkSummary[];
  viewAll: { label: string; href: string };
};

export type HomeStoryVm = NonNullable<HomePageComposerResult["story"]>;

export type HomeArtistsVm = {
  cards: CatalogueArtistCardVm[];
  /** lax.art's artist directory, where the full stories are; null when lax.art is not linked. */
  laxArtHref: string | null;
};

export type HomePageViewModel = {
  hero: HomeHeroVm;
  trust: HomeTrustItemVm[];
  quickFilters: HomeQuickFilterVm[];
  /** Null when there are too few editions for a row; the error state shows instead if it failed. */
  newEditions: HomeNewEditionsVm | null;
  story: HomeStoryVm | null;
  artists: HomeArtistsVm | null;
  collections: HomeCollectionVm[];
  galleryTeam: GalleryTeamVm;
  doors: MarketingProductDoorVm[];
  sectionErrors: Partial<Record<HomeSectionKey, string>>;
};

export type HomePageContext = {
  now: Date;
  artBaseUrl: URL | null;
  productLinks: readonly LaxProductLinkVm[];
  /** Policy pages that can be linked; drafts hidden on production are left out. */
  linkablePolicies: readonly ShopPolicySlug[];
  deliveryTimes: CheckoutDeliveryTimes;
};

function editionHref(slug: string): string {
  return `/artworks/${encodeURIComponent(slug)}`;
}

/**
 * The release in the first screen: the first featured edition with an image that can still be
 * bought, then any featured edition with an image, then the newest edition on sale.
 */
export function selectHomeRelease(
  featured: readonly PublicArtworkSummary[],
  newest: readonly PublicArtworkSummary[],
): { item: PublicArtworkSummary; featured: boolean } | null {
  const withImage = (item: PublicArtworkSummary) => item.imageUrl !== null;
  const onSale = featured.find((item) => withImage(item) && !isCatalogueArtworkSoldOut(item));
  if (onSale) return { item: onSale, featured: true };
  const anyFeatured = featured.find(withImage);
  if (anyFeatured) return { item: anyFeatured, featured: true };
  const fallback = newest.find(withImage);
  return fallback ? { item: fallback, featured: false } : null;
}

function releaseEyebrow(item: PublicArtworkSummary, featured: boolean, now: Date): string {
  const date = formatReleaseDate(item.listedAt);
  if (date && isNewRelease(item.listedAt, now)) return `New release · ${date}`;
  return featured ? "Featured edition" : "On sale now";
}

function toRelease(item: PublicArtworkSummary): HomeReleaseVm {
  const soldOut = isCatalogueArtworkSoldOut(item);
  const size = item.dimensionsCmDisplay ?? item.dimensions;
  const facts = [item.medium, size].filter((part): part is string => Boolean(part?.trim()));
  return {
    href: editionHref(item.slug),
    imageUrl: item.imageUrl ?? "",
    imageAlt: `${item.title} by ${item.artistName}`,
    artistName: item.artistName,
    titleLine: item.yearCreated ? `${item.title}, ${item.yearCreated}` : item.title,
    priceLabel: soldOut
      ? "Sold out"
      : item.printPricePence !== null
        ? formatGbpPenceForDisplay(item.printPricePence)
        : null,
    factsLine: facts.length > 0 ? facts.join(" · ") : null,
    editionLine:
      item.availability.totalEditions > 0 ? `Edition of ${item.availability.totalEditions}` : null,
  };
}

/** "Limited-edition prints by 12 gallery artists, from £95. Prices include VAT." */
export function heroLead(artistCount: number | null, lowestPricePence: number | null): string {
  const artists =
    artistCount !== null && artistCount >= MIN_ARTIST_COUNT_IN_LEAD
      ? ` by ${artistCount} gallery artists`
      : "";
  const from =
    lowestPricePence !== null ? ` from ${formatGbpPenceForDisplay(lowestPricePence)}` : "";
  const joiner = artists && from ? "," : "";
  return `Limited-edition prints${artists}${joiner}${from}. Prices include VAT.`;
}

function buildHero(input: HomePageComposerResult, now: Date): HomeHeroVm {
  const selected = selectHomeRelease(input.featured, input.editions);
  const release = selected ? toRelease(selected.item) : null;
  return {
    eyebrow: selected ? releaseEyebrow(selected.item, selected.featured, now) : null,
    title: SHOP_HOME_CONTENT.hero.title,
    lead: heroLead(input.artistCount, input.lowestPricePence),
    primary: { label: SHOP_HOME_CONTENT.hero.primaryLabel, href: "/artworks" },
    workLink: selected
      ? { label: `See ${selected.item.title}`, href: editionHref(selected.item.slug) }
      : null,
    release,
  };
}

function policyLink(
  linkable: readonly ShopPolicySlug[],
  slug: ShopPolicySlug,
  label: string,
): HomeTrustItemVm["link"] {
  return linkable.includes(slug) ? { label, href: SHOP_POLICY_PATHS[slug] } : null;
}

/** Four plain promises under the hero, each one checkout and the policies keep. */
export function buildHomeTrust(context: HomePageContext): HomeTrustItemVm[] {
  const delivery = formatGbpPenceForDisplay(FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery);
  const window = context.deliveryTimes.ukDelivery;
  const collection = FULFILMENT_SURCHARGE_PENCE.collect_new_cavendish === 0 ? "free " : "";
  return [
    {
      id: "editions",
      title: "Limited editions",
      body: "Every work states its edition size. Your print’s number is given when your order is fulfilled.",
      link: null,
    },
    {
      id: "gallery",
      title: "From our Marylebone gallery",
      body: `Sold by ${legalEntityFor("shop").tradingName}, ${SHOP_HELP_CONTACT.address}.`,
      link: policyLink(context.linkablePolicies, "help", "Help and contact"),
    },
    {
      id: "delivery",
      title: `Insured UK delivery, ${delivery}`,
      body: `${window ? `${workingDaysLabel(window)}, or ` : "Or "}${collection}collection from the gallery.`,
      link: policyLink(context.linkablePolicies, "delivery", "Delivery"),
    },
    {
      id: "returns",
      title: "14-day cancellation",
      body: "Change your mind within 14 days of delivery.",
      link: policyLink(context.linkablePolicies, "returns", "Returns"),
    },
  ];
}

function buildNewEditions(
  input: HomePageComposerResult,
  releaseSlug: string | null,
): HomeNewEditionsVm | null {
  const others = input.editions.filter((item) => item.slug !== releaseSlug);
  // The release may repeat below when leaving it out would leave the row short.
  const pool = others.length >= MIN_COLLECTION_SIZE ? others : input.editions;
  if (pool.length < MIN_COLLECTION_SIZE) return null;
  const total = input.availableCount;
  return {
    items: pool.slice(0, NEW_EDITIONS_ROW),
    viewAll: {
      label: total !== null && total > NEW_EDITIONS_ROW ? `View all ${total}` : "View all",
      href: "/artworks?availability=available",
    },
  };
}

function buildArtists(input: HomePageComposerResult, artBaseUrl: URL | null): HomeArtistsVm | null {
  const withEditions = input.artists.filter((artist) => artist.artworkCount > 0);
  if (withEditions.length < MIN_HOME_ARTISTS) return null;
  return {
    cards: buildCatalogueArtistCards(withEditions.slice(0, 4)),
    laxArtHref: artBaseUrl ? new URL("/artists", artBaseUrl).toString() : null,
  };
}

/** lax.art first, then LAX Bid; a product without a link here is left out. */
export function buildShopProductDoors(
  links: readonly LaxProductLinkVm[],
): MarketingProductDoorVm[] {
  const hrefOf = (id: LaxProductLinkVm["id"]) => links.find((link) => link.id === id)?.href;
  const doors: MarketingProductDoorVm[] = [];
  const art = hrefOf("art");
  if (art) doors.push({ product: "art", href: art, ...SHOP_HOME_CONTENT.doors.art });
  const bid = hrefOf("bid");
  if (bid) doors.push({ product: "bid", href: bid, ...SHOP_HOME_CONTENT.doors.bid });
  return doors;
}

/**
 * The Shop home page: one release told well, the promises that matter, a short curated
 * selection and the ways in, then the gallery team and the rest of LAX. Every section is built
 * from what the catalogue holds now, and a section with too little to show is left out.
 */
export function buildHomePageViewModel(
  input: HomePageComposerResult,
  context: HomePageContext,
): HomePageViewModel {
  const hero = buildHero(input, context.now);
  const releaseSlug = selectHomeRelease(input.featured, input.editions)?.item.slug ?? null;
  const priceBand = choosePriceBand(input.priceBands, input.availableCount);
  const categories = chooseCollectionCategories(input.facets, priceBand ? 2 : 3);

  return {
    hero,
    trust: buildHomeTrust(context),
    quickFilters: buildHomeQuickFilters({ facets: input.facets, priceBand }),
    newEditions: buildNewEditions(input, releaseSlug),
    story: input.story,
    artists: buildArtists(input, context.artBaseUrl),
    collections: buildHomeCollections({
      priceBand,
      categories,
      categoryCovers: input.categoryCovers,
    }),
    galleryTeam: buildGalleryTeam(),
    doors: buildShopProductDoors(context.productLinks),
    sectionErrors: input.sectionErrors,
  };
}
