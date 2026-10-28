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
import { type HomeNewEditionsVm, buildHomeNewEditions } from "@/lib/home/home-new-editions";
import type { HomePageComposerResult, HomeSectionKey } from "@/lib/home/home-page.composer";
import { homeReleaseEyebrow, selectHomeRelease } from "@/lib/home/home-release";
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
  /** "Now released: Vessel Study, 2014 · £120". */
  line: string;
};

export type HomeHeroVm = {
  /** "New release · 28 Oct 2026", "Featured edition", or null. */
  eyebrow: string | null;
  title: string;
  lead: string;
  /** "Browse editions"; null when nothing is on sale. */
  primary: { label: string; href: string } | null;
  /** "See Vessel Study", beside the primary action; null without a release. */
  workLink: { label: string; href: string } | null;
  release: HomeReleaseVm | null;
  browseRows: HomeBrowseRowVm[];
  /** With nothing on sale, the one way on from the first screen. */
  emptyAction: { label: string; href: string } | null;
};

export type HomePageViewModel = {
  /** The sections shown, in order, and the surface each renders on. */
  layout: ShopPageSections<HomeSectionId>;
  hero: HomeHeroVm;
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
  const title = item.yearCreated ? `${item.title}, ${item.yearCreated}` : item.title;
  const parts = [title];
  if (item.printPricePence !== null) parts.push(formatGbpPenceForDisplay(item.printPricePence));
  return `Now released: ${parts.join(" · ")}`;
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
      workLink: null,
      release: null,
      browseRows: [],
      emptyAction: art
        ? { label: copy.emptyArtLabel, href: art.href }
        : { label: copy.emptyHelpLabel, href: "/help" },
    };
  }
  const choice = selectHomeRelease(input.featured, input.editions);
  return {
    eyebrow: choice ? homeReleaseEyebrow(choice, context.now) : null,
    title: copy.title,
    lead: heroLead({
      artistNames: input.artists.map((artist) => artist.name),
      artistCount: input.artistCount,
      lowestPricePence: input.lowestPricePence,
    }),
    primary: { label: copy.primaryLabel, href: "/artworks" },
    workLink: choice
      ? { label: `See ${choice.item.title}`, href: editionHref(choice.item.slug) }
      : null,
    release: choice
      ? {
          href: editionHref(choice.item.slug),
          imageUrl: choice.item.imageUrl ?? "",
          imageAlt: `${choice.item.title} by ${choice.item.artistName}`,
          line: releaseLine(choice.item),
        }
      : null,
    browseRows: buildHomeBrowseRows({ facets: input.facets, priceRanges: input.priceRanges }),
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
  const releaseSlug = empty
    ? null
    : (selectHomeRelease(input.featured, input.editions)?.item.slug ?? null);
  const priceBand = choosePriceBand(input.priceBands, input.availableCount);
  const categories = chooseCollectionCategories(
    input.facets,
    MAX_COLLECTIONS - (priceBand ? 1 : 0),
  );

  const trust = buildHomeTrust(context);
  const newEditions = empty
    ? null
    : buildHomeNewEditions({
        editions: input.editions,
        releaseSlug,
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
      trust: !empty,
      // A failed read keeps the section, with its error state in place of the row.
      "new-editions": newEditions !== null || Boolean(input.sectionErrors.editions),
      artists: artists !== null,
      collections: collections.length > 0,
      "product-doors": doors.length > 0,
    }),
    hero,
    trust,
    newEditions,
    artists,
    collections,
    galleryTeam: buildGalleryTeam({ context: "home" }),
    doors,
    sectionErrors: input.sectionErrors,
  };
}
