import type { ArtViewerState } from "@/lib/art-viewer-state";
import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import {
  type CatalogueArtworkCardVm,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtEditorialPlacement } from "@/lib/editorial/art-editorial.types";
import { type EditorialCardVm, buildPlacementCards } from "@/lib/editorial/editorial-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import {
  type ArtHomeGalleryCardVm,
  type ArtHomeVenueEntry,
  buildArtHomeGalleryCards,
} from "@/lib/home/art-home-galleries.vm";
import { ART_HOME_HERO_HEADLINE } from "@/lib/home/art-home-hero.vm";
import { type ArtHomeGuidePromoVm, buildArtHomeGuidePromoVm } from "@/lib/home/art-home-promos.vm";
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
      whatsOn: EditorialCardVm[];
      stories: EditorialCardVm[];
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
  /** One lead plus up to three (Figma `285:3008`). */
  whatsOn: EditorialCardVm[];
  featuredArtworks: CatalogueArtworkCardVm[];
  featuredArtists: CatalogueArtistCardVm[];
  productDoors: MarketingProductDoorVm[];
  /** One lead plus up to two (Figma `285:3061`). */
  stories: EditorialCardVm[];
  guidePromo: ArtHomeGuidePromoVm;
  galleries: ArtHomeGalleryCardVm[];
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

const WHATS_ON_LIMIT = 4;
const STORIES_LIMIT = 3;
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
    whatsOn: buildPlacementCards(placements, "home_whats_on", "What's on"),
    stories: buildPlacementCards(placements, "home_stories", "Story"),
    guide: buildPlacementCards(placements, "home_guide", "Guide"),
    promos: placements,
  };
}

export async function composeArtHomePage(services: {
  catalogue: ArtCataloguePort;
  viewer: ArtViewerPort;
  favorites: ArtFavoritesReadPort;
  editorial: Pick<ArtEditorialPort, "home" | "listVenues" | "getVenue">;
  ecosystem: ArtEcosystemPort;
}): Promise<ArtHomePageVm> {
  const favoritesPromise = loadViewerFavoriteContext(services, "/", {
    savedArtworks: true,
    followedArtists: true,
  });
  const editorialPromise = services.editorial.home();
  const venuesPromise = loadGalleryEntries(services.editorial);
  const [artworks, artists] = await Promise.allSettled([
    curatedOrNewest(
      () => services.catalogue.listArtworks({ limit: 8, placement: "featured_originals" }),
      () => services.catalogue.listArtworks({ limit: 8 }),
    ),
    curatedOrNewest(
      () => services.catalogue.listArtists({ limit: 6, placement: "featured_artists" }),
      () => services.catalogue.listArtists({ limit: 6 }),
    ),
  ]);
  const [favorites, editorialResult, venuesResult] = await Promise.all([
    favoritesPromise,
    editorialPromise,
    venuesPromise,
  ]);

  const editorial = homeEditorial(editorialResult);
  const whatsOn = editorial.kind === "ok" ? editorial.whatsOn.slice(0, WHATS_ON_LIMIT) : [];
  const stories = editorial.kind === "ok" ? editorial.stories.slice(0, STORIES_LIMIT) : [];
  const featuredArtists =
    artists.status === "fulfilled"
      ? buildCatalogueArtistCards(artists.value.items, favorites.followedArtistSlugs)
      : [];
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
    "featured-artists": marketingRailHasEnough(featuredArtists.length),
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
    viewer: favorites.viewer,
    favoriteAuth: favorites.favoriteAuth,
    sectionErrors,
  };
}
