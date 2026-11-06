import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import type { ShopPolicySlug } from "@/content/policies/shop-policy-status";
import type { CheckoutDeliveryTimes } from "@/lib/checkout/checkout-delivery";
import { type GalleryTeamVm, buildGalleryTeam } from "@/lib/gallery-team/gallery-team.vm";
import { type HomeArtistsVm, buildHomeArtists } from "@/lib/home/home-artists";
import {
  type HomeBrowseRowVm,
  type HomeCollectionVm,
  MAX_COLLECTIONS,
  buildHomeBrowseRows,
  buildHomeCollections,
  chooseCollectionCategories,
  choosePriceBand,
} from "@/lib/home/home-browse-paths";
import type { ShopCoverPlate } from "@/lib/home/home-cover.adapter";
import { editionSizeCm, editionSizeLabel } from "@/lib/home/home-edition-size";
import { type HomeHangVm, buildHomeHang } from "@/lib/home/home-hang";
import {
  type ShopImageFacts,
  deepFieldFromMean,
  paleFieldFromMean,
} from "@/lib/home/home-image-facts";
import { type HomeNewEditionsVm, buildHomeNewEditions } from "@/lib/home/home-new-editions";
import type { HomePageComposerResult, HomeSectionKey } from "@/lib/home/home-page.composer";
import { homeReleaseEyebrow, isNewReleaseChoice, selectHomeRelease } from "@/lib/home/home-release";
import { type HomeSectionId, resolveHomeSections } from "@/lib/home/home-sections";
import { type HomeTrustVm, buildHomeTrust } from "@/lib/home/home-trust";
import type { ShopPageSections } from "@/lib/layout/shop-page-sections";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { MarketingProductDoorVm } from "@auction/marketing-ui";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";

/** "by {n} gallery artists" only reads as a strength from this many; below it, names read better. */
const MIN_ARTIST_COUNT_IN_LEAD = 3;

export type HomeReleaseVm = {
  href: string;
  imageUrl: string;
  imageAlt: string;
  /** "Flora Powers · Vessel Study · edition of 24 · £120". */
  line: string;
};

export type HomeHeroVm = {
  /** "New release · 28 Oct 2026", "Featured edition", or null. */
  eyebrow: string | null;
  title: string;
  lead: string;
  /** "Browse editions"; null when nothing is on sale. */
  primary: { label: string; href: string } | null;
  /** The quieter way on beside the primary action: all editions, or the artists. */
  link: { label: string; href: string } | null;
  release: HomeReleaseVm | null;
  browseRows: HomeBrowseRowVm[];
  /** With nothing on sale, the one way on from the first screen. */
  emptyAction: { label: string; href: string } | null;
};

export type HomePageViewModel = {
  /** The sections shown, in order, and the surface each renders on. */
  layout: ShopPageSections<HomeSectionId>;
  hero: HomeHeroVm;
  /** The release's print on its pale field; null when it could not be read, so the cover is type. */
  coverPlate: ShopCoverPlate | null;
  /** "New editions" hung on their sheets; null with fewer than two photographed editions. */
  hang: HomeHangVm | null;
  trust: HomeTrustVm;
  /** Null when no edition is left after the release; the error state shows if the read failed. */
  newEditions: HomeNewEditionsVm | null;
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
  /** The address a work's photograph is shown from, or null without one. */
  imageSrc: (item: PublicArtworkSummary) => string | null;
  /** What was read from each photograph, by the address it is shown from. */
  imageFacts: ReadonlyMap<string, ShopImageFacts>;
};

function editionHref(slug: string): string {
  return `/artworks/${encodeURIComponent(slug)}`;
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * "Editions by Flora Powers, from £42. Prices include VAT." From three artists the names give way
 * to "by 12 gallery artists". It says nothing about signing or numbering: each edition states
 * those facts for itself.
 */
export function heroLead(input: {
  artistNames: readonly string[];
  artistCount: number | null;
  lowestPricePence: number | null;
}): string {
  const count = input.artistCount ?? input.artistNames.length;
  const by =
    count >= MIN_ARTIST_COUNT_IN_LEAD
      ? ` by ${count} gallery artists`
      : input.artistNames.length > 0
        ? ` by ${listNames(input.artistNames)}`
        : " by the gallery’s artists";
  const from =
    input.lowestPricePence !== null
      ? `, from ${formatGbpPenceForDisplay(input.lowestPricePence)}`
      : "";
  return `Editions${by}${from}. Prices include VAT.`;
}

function releaseLine(item: PublicArtworkSummary): string {
  const total = item.availability.totalEditions;
  return [
    item.artistName,
    item.title,
    total > 0 ? `edition of ${total}` : null,
    item.printPricePence !== null ? formatGbpPenceForDisplay(item.printPricePence) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "A new limited edition by Flora Powers · Giclée print · 120 × 90 cm": one line of fact. */
function releaseFact(item: PublicArtworkSummary, isNew: boolean): string {
  const lead = `${isNew ? "A new limited edition" : "A limited edition"} by ${item.artistName}`;
  return [lead, item.medium, editionSizeLabel(editionSizeCm(item))].filter(Boolean).join(" · ");
}

/** True only when the catalogue answered and holds nothing that can be bought now. */
function nothingOnSale(input: HomePageComposerResult): boolean {
  return input.availableCount === 0 && !input.sectionErrors.editions;
}

function buildHero(input: HomePageComposerResult, context: HomePageContext): HomeHeroVm {
  const copy = SHOP_HOME_CONTENT.hero;
  if (nothingOnSale(input)) {
    const art = context.productLinks.find((link) => link.id === "art");
    return {
      eyebrow: null,
      title: copy.emptyTitle,
      lead:
        (input.facets?.availability.soldOut ?? 0) > 0 ? copy.emptyLeadSoldOut : copy.emptyLeadFirst,
      primary: null,
      link: null,
      release: null,
      browseRows: [],
      emptyAction: art
        ? { label: copy.emptyArtLabel, href: art.href }
        : { label: copy.emptyHelpLabel, href: "/help" },
    };
  }
  const choice = selectHomeRelease(input.featured, input.editions, context);
  const browseRows = buildHomeBrowseRows({ facets: input.facets, priceRanges: input.priceRanges });
  if (choice) {
    const { item } = choice;
    return {
      eyebrow: homeReleaseEyebrow(choice, context.now),
      title: item.title,
      lead: releaseFact(item, isNewReleaseChoice(choice, context.now)),
      primary: { label: copy.releaseLabel, href: editionHref(item.slug) },
      link: { label: copy.allEditionsLabel, href: "/artworks" },
      release: {
        href: editionHref(item.slug),
        imageUrl: context.imageSrc(item) ?? "",
        imageAlt: `${item.title} by ${item.artistName}`,
        line: releaseLine(item),
      },
      browseRows,
      emptyAction: null,
    };
  }
  return {
    eyebrow: null,
    title: copy.title,
    lead: heroLead({
      artistNames: input.artists.map((artist) => artist.name),
      artistCount: input.artistCount,
      lowestPricePence: input.lowestPricePence,
    }),
    primary: { label: copy.primaryLabel, href: "/artworks" },
    link: { label: copy.artistsLabel, href: "/artists" },
    release: null,
    browseRows,
    emptyAction: null,
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
 * The Shop home page: one release told well, the promises that matter, the newest editions and
 * the artists behind them, the ways in, then the rest of LAX and the gallery team. Every section is
 * built from what the catalogue holds now; a section with nothing to show is left out, and with
 * nothing on sale only the first screen, the doors and the gallery team remain.
 */
export function buildHomePageViewModel(
  input: HomePageComposerResult,
  context: HomePageContext,
): HomePageViewModel {
  const empty = nothingOnSale(input);
  const hero = buildHero(input, context);
  const choice = empty ? null : selectHomeRelease(input.featured, input.editions, context);
  const releaseSlug = choice?.item.slug ?? null;
  const priceBand = choosePriceBand(input.priceBands, input.availableCount);
  const categories = chooseCollectionCategories(
    input.facets,
    MAX_COLLECTIONS - (priceBand ? 1 : 0),
  );

  const releaseFacts = hero.release ? context.imageFacts.get(hero.release.imageUrl) : undefined;
  const coverPlate: ShopCoverPlate | null = releaseFacts
    ? {
        width: releaseFacts.width,
        height: releaseFacts.height,
        field: paleFieldFromMean(releaseFacts.mean),
        fieldDark: deepFieldFromMean(releaseFacts.mean),
      }
    : null;
  const hang = empty
    ? null
    : buildHomeHang({
        editions: choice ? [choice.item, ...input.editions] : input.editions,
        availableCount: input.availableCount,
        imageSrc: context.imageSrc,
        facts: context.imageFacts,
      });

  const trust = buildHomeTrust(context);
  // The wall takes the "New editions" place when it can be hung; the card row is its fallback.
  const newEditions =
    empty || hang
      ? null
      : buildHomeNewEditions({
          editions: input.editions,
          releaseSlug,
          releaseWorkSlug: choice?.item.workSlug ?? releaseSlug,
          availableCount: input.availableCount,
        });
  const artists = empty
    ? null
    : buildHomeArtists({
        artists: input.artists,
        total: input.artistCount,
        soloDetail: input.soloArtist,
        artBaseUrl: context.artBaseUrl,
      });
  const collections = empty
    ? []
    : buildHomeCollections({ priceBand, categories, categoryCovers: input.categoryCovers });
  const doors = buildShopProductDoors(context.productLinks);

  return {
    layout: resolveHomeSections({
      hang: hang !== null,
      browse: hero.browseRows.length > 0,
      trust: !empty,
      // A failed read keeps the section, with its error state in place of the row.
      "new-editions": newEditions !== null || Boolean(input.sectionErrors.editions),
      artists: artists !== null,
      collections: collections.length > 0,
      "product-doors": doors.length > 0,
    }),
    hero,
    coverPlate,
    hang,
    trust,
    newEditions,
    artists,
    collections,
    galleryTeam: buildGalleryTeam({ context: "home" }),
    doors,
    sectionErrors: input.sectionErrors,
  };
}
