import type { ArtViewerState } from "@/lib/art-viewer-state";
import type { CatalogueArtistCardSource } from "@/lib/catalogue/catalogue-artist-card.vm";
import {
  type CatalogueArtworkCardVm,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtEditorialPlacement } from "@/lib/editorial/art-editorial.types";
import type {
  ArtEditorialExhibitionDetail,
  ArtEditorialExhibitionSummary,
  ArtEditorialStorySummary,
} from "@/lib/editorial/art-editorial.types";
import { type EditorialCardVm, buildPlacementCards } from "@/lib/editorial/editorial-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import {
  FEATURED_ARTISTS_LIMIT,
  type FeaturedArtistsVm,
  buildFeaturedArtists,
  featuredArtistNeedsDetail,
} from "@/lib/home/art-featured-artists.vm";
import {
  type ArtHomeGalleryCardVm,
  type ArtHomeVenueEntry,
  buildArtHomeGalleryCards,
} from "@/lib/home/art-home-galleries.vm";
import { ART_HOME_HERO_HEADLINE } from "@/lib/home/art-home-hero.vm";
import { type ArtHomeGuidePromoVm, buildArtHomeGuidePromoVm } from "@/lib/home/art-home-promos.vm";
import { buildHomeStoryCards } from "@/lib/home/art-home-stories.vm";
import { isTextLedSection } from "@/lib/home/art-home-text-led";
import {
  type WhatsOnPick,
  buildWhatsOnCards,
  pickWhatsOn,
  whatsOnNeedsDetail,
} from "@/lib/home/art-home-whats-on.vm";
import type {
  ArtCataloguePort,
  ArtEcosystemPort,
  ArtEditorialPort,
  ArtFavoritesReadPort,
  ArtViewerPort,
} from "@/lib/ports";
import { buildArtProductDoors } from "@/lib/product-doors/art-product-doors.vm";
import {
  type MarketingBandSection,
  type MarketingProductDoorVm,
  type MarketingSectionSurface,
  marketingRailHasEnough,
  resolveBandSequence,
} from "@auction/marketing-ui";

type ArtHomeSection = "artworks" | "artists";

/** Sections below the hero, in Figma order (desktop `285:2928`; mobile keeps the same order). */
export type ArtHomeSectionId =
  | "whats-on"
  | "curators-picks"
  | "featured-artists"
  | "product-doors"
  | "stories"
  | "guide"
  | "galleries"
  | "closing-cta";

type ArtHomeEditorialVm =
  | { kind: "hidden" }
  | {
      kind: "ok";
      hero: EditorialCardVm | null;
      guide: EditorialCardVm[];
      promos: ArtEditorialPlacement[];
    }
  | { kind: "failed" };

export type ArtHomePageVm = {
  /** Visible sections in render order; a section with no data is left out. */
  sections: ArtHomeSectionId[];
  /** The surface each visible section renders on, so two tinted bands never sit together. */
  surfaces: Record<ArtHomeSectionId, MarketingSectionSurface>;
  hero: EditorialCardVm | null;
  /**
   * The lead exhibition (a large card with "Visit" and "See the works") and a second as a
   * smaller card. Every card has an image frame: never text-only.
   */
  whatsOn: EditorialCardVm[];
  featuredArtworks: CatalogueArtworkCardVm[];
  /** Laid out for its count; null when no artist is featured. */
  featuredArtists: FeaturedArtistsVm | null;
  productDoors: MarketingProductDoorVm[];
  /** Up to three stories, each with a cover image; a story without one is left out. */
  stories: EditorialCardVm[];
  guidePromo: ArtHomeGuidePromoVm;
  galleries: ArtHomeGalleryCardVm[];
  /** Sections with no image among their items; they lead with text instead of placeholders. */
  textLed: { galleries: boolean };
  viewer: ArtViewerState;
  favoriteAuth: ArtFavoriteAuth;
  /** Sections whose upstream read failed; the page shows an inline error instead. */
  sectionErrors: ArtHomeSection[];
};

/**
 * The surface each section asks for. The guide promo can render on the plain page; the gallery
 * team panel is always tinted, so a band next to it gives way.
 */
const SECTION_SURFACE: Record<
  ArtHomeSectionId,
  Omit<MarketingBandSection<ArtHomeSectionId>, "id">
> = {
  "whats-on": { surface: "plain", flexible: false },
  "curators-picks": { surface: "plain", flexible: false },
  "featured-artists": { surface: "plain", flexible: false },
  "product-doors": { surface: "plain", flexible: false },
  stories: { surface: "plain", flexible: false },
  guide: { surface: "band", flexible: true },
  galleries: { surface: "plain", flexible: false },
  "closing-cta": { surface: "band", flexible: false },
};

/** Figma shows two galleries (`285:2928`). */
const GALLERIES_LIMIT = 2;

/**
 * The venue list carries no address, so each shown venue's detail is read in parallel. A failed
 * detail read drops the address lines but keeps the card.
 */
async function loadGalleryEntries(
  editorial: Pick<ArtEditorialPort, "listVenues" | "getVenue">,
): Promise<ArtHomeVenueEntry[]> {
  const list = await editorial.listVenues();
  if (list.status !== "ok") return [];
  return Promise.all(
    list.data.items.slice(0, GALLERIES_LIMIT).map(async (summary) => {
      const detail = await editorial.getVenue(summary.slug).catch(() => null);
      return { summary, detail: detail?.status === "ok" ? detail.data : null };
    }),
  );
}

/** The exhibitions on now; a failed read leaves the curated placements to stand alone. */
async function loadCurrentExhibitions(
  editorial: Pick<ArtEditorialPort, "listExhibitions">,
): Promise<ArtEditorialExhibitionSummary[]> {
  const result = await editorial.listExhibitions("current").catch(() => null);
  return result?.status === "ok" ? result.data.items : [];
}

/** Published stories, for their covers and reading times; a failed read leaves placements bare. */
async function loadStories(
  editorial: Pick<ArtEditorialPort, "listStories">,
): Promise<ArtEditorialStorySummary[]> {
  const result = await editorial.listStories().catch(() => null);
  return result?.status === "ok" ? result.data.items : [];
}

/** Reads the detail of the shown exhibitions that need it (venue, lead artwork image). */
async function loadWhatsOnDetails(
  editorial: Pick<ArtEditorialPort, "getExhibition">,
  picks: readonly WhatsOnPick[],
): Promise<Map<string, ArtEditorialExhibitionDetail>> {
  const details = new Map<string, ArtEditorialExhibitionDetail>();
  await Promise.all(
    picks.map(async (pick) => {
      if (!pick.slug || !whatsOnNeedsDetail(pick)) return;
      const result = await editorial.getExhibition(pick.slug).catch(() => null);
      if (result?.status === "ok") details.set(pick.slug, result.data);
    }),
  );
  return details;
}

/** Home placements are curated in Shop admin and may hold no Art-channel items yet. */
export async function curatedOrNewest<T extends { items: readonly unknown[] }>(
  curated: () => Promise<T>,
  newest: () => Promise<T>,
): Promise<T> {
  const result = await curated();
  return result.items.length > 0 ? result : newest();
}

function homeEditorial(result: Awaited<ReturnType<ArtEditorialPort["home"]>>): ArtHomeEditorialVm {
  if (result.status === "disabled") return { kind: "hidden" };
  if (result.status !== "ok") return { kind: "failed" };
  const { placements } = result.data;
  return {
    kind: "ok",
    hero: buildPlacementCards(placements, "home_hero", ART_HOME_HERO_HEADLINE)[0] ?? null,
    guide: buildPlacementCards(placements, "home_guide", "Guide"),
    promos: placements,
  };
}

/** The only featured artist is told at length, so its detail is read; a failed read keeps the card. */
async function loadFeaturedArtists(
  catalogue: Pick<ArtCataloguePort, "getArtist">,
  artists: readonly CatalogueArtistCardSource[],
  followedSlugs: ReadonlySet<string>,
): Promise<FeaturedArtistsVm | null> {
  const only = artists[0];
  const soloDetail =
    only && featuredArtistNeedsDetail(artists.length)
      ? await catalogue.getArtist(only.slug).catch(() => null)
      : null;
  return buildFeaturedArtists({ artists, followedSlugs, soloDetail });
}

export async function composeArtHomePage(services: {
  catalogue: ArtCataloguePort;
  viewer: ArtViewerPort;
  favorites: ArtFavoritesReadPort;
  editorial: Pick<
    ArtEditorialPort,
    "home" | "listVenues" | "getVenue" | "listExhibitions" | "getExhibition" | "listStories"
  >;
  ecosystem: ArtEcosystemPort;
}): Promise<ArtHomePageVm> {
  const favoritesPromise = loadViewerFavoriteContext(services, "/", {
    savedArtworks: true,
    followedArtists: true,
  });
  const editorialPromise = services.editorial.home();
  const venuesPromise = loadGalleryEntries(services.editorial);
  const exhibitionsPromise = loadCurrentExhibitions(services.editorial);
  const storiesPromise = loadStories(services.editorial);
  const [artworks, artists] = await Promise.allSettled([
    curatedOrNewest(
      () => services.catalogue.listArtworks({ limit: 8, placement: "featured_originals" }),
      () => services.catalogue.listArtworks({ limit: 8 }),
    ),
    curatedOrNewest(
      () =>
        services.catalogue.listArtists({
          limit: FEATURED_ARTISTS_LIMIT,
          placement: "featured_artists",
        }),
      () => services.catalogue.listArtists({ limit: FEATURED_ARTISTS_LIMIT }),
    ),
  ]);
  const [favorites, editorialResult, venuesResult, currentExhibitions, publishedStories] =
    await Promise.all([
      favoritesPromise,
      editorialPromise,
      venuesPromise,
      exhibitionsPromise,
      storiesPromise,
    ]);

  const editorial = homeEditorial(editorialResult);
  const placements = editorial.kind === "ok" ? editorial.promos : [];
  const whatsOnPicks = pickWhatsOn(placements, currentExhibitions);
  const whatsOn = buildWhatsOnCards(
    whatsOnPicks,
    await loadWhatsOnDetails(services.editorial, whatsOnPicks),
  );
  const stories = buildHomeStoryCards({ placements, stories: publishedStories });
  const featuredArtists = await loadFeaturedArtists(
    services.catalogue,
    artists.status === "fulfilled" ? artists.value.items : [],
    favorites.followedArtistSlugs,
  );
  const productDoors = buildArtProductDoors(
    services.ecosystem.crossProductLinks(),
    editorial.kind === "ok" ? editorial.promos : [],
  );
  const galleries = buildArtHomeGalleryCards(venuesResult);

  const sectionErrors: ArtHomeSection[] = [];
  if (artworks.status === "rejected") sectionErrors.push("artworks");
  if (artists.status === "rejected") sectionErrors.push("artists");

  const featuredArtworks =
    artworks.status === "fulfilled"
      ? buildCatalogueArtworkCards(artworks.value.items, favorites.savedArtworkSlugs)
      : [];

  // Rails need enough items to read as a rail; with fewer the section hides rather than leaving
  // most of its row empty. Curators' picks keeps its inline error; the guide promo and closing
  // CTA are static copy.
  const visible: Record<ArtHomeSectionId, boolean> = {
    "whats-on": whatsOn.length > 0,
    "curators-picks":
      sectionErrors.includes("artworks") || marketingRailHasEnough(featuredArtworks.length),
    "featured-artists": featuredArtists !== null,
    "product-doors": productDoors.length > 0,
    stories: stories.length > 0,
    guide: true,
    galleries: galleries.length > 0,
    "closing-cta": true,
  };

  const sections = (Object.keys(visible) as ArtHomeSectionId[]).filter((id) => visible[id]);

  return {
    sections,
    surfaces: resolveBandSequence(sections.map((id) => ({ id, ...SECTION_SURFACE[id] }))),
    hero: editorial.kind === "ok" ? editorial.hero : null,
    whatsOn,
    featuredArtworks,
    featuredArtists,
    productDoors,
    stories,
    guidePromo: buildArtHomeGuidePromoVm(editorial.kind === "ok" ? editorial.guide : []),
    galleries,
    textLed: { galleries: isTextLedSection(galleries) },
    viewer: favorites.viewer,
    favoriteAuth: favorites.favoriteAuth,
    sectionErrors,
  };
}
