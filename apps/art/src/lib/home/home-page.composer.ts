import type { ArtViewerState } from "@/lib/art-viewer-state";
import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import {
  type CatalogueArtworkCardVm,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import { type EditorialCardVm, buildPlacementCards } from "@/lib/editorial/editorial-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import {
  type ArtHomeEcosystemCardVm,
  buildArtHomeEcosystemCards,
} from "@/lib/home/art-home-ecosystem.vm";
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

type ArtHomeSection = "artworks" | "artists";

/** Sections below the hero, in Figma order (desktop `285:2928`; mobile keeps the same order). */
export type ArtHomeSectionId =
  | "whats-on"
  | "curators-picks"
  | "featured-artists"
  | "ecosystem"
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
    }
  | { kind: "failed" };

export type ArtHomePageVm = {
  /** Visible sections in render order; a section with no data is left out. */
  sections: ArtHomeSectionId[];
  hero: EditorialCardVm | null;
  /** One lead plus up to three (Figma `285:3008`). */
  whatsOn: EditorialCardVm[];
  featuredArtworks: CatalogueArtworkCardVm[];
  featuredArtists: CatalogueArtistCardVm[];
  ecosystem: ArtHomeEcosystemCardVm[];
  /** One lead plus up to two (Figma `285:3061`). */
  stories: EditorialCardVm[];
  guidePromo: ArtHomeGuidePromoVm;
  galleries: ArtHomeGalleryCardVm[];
  viewer: ArtViewerState;
  favoriteAuth: ArtFavoriteAuth;
  /** Sections whose upstream read failed; the page shows an inline error instead. */
  sectionErrors: ArtHomeSection[];
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
async function curatedOrNewest<T extends { items: readonly unknown[] }>(
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
      () =>
        services.catalogue.listArtworks({
          limit: 8,
          placement: "featured_originals",
          type: "original",
        }),
      () => services.catalogue.listArtworks({ limit: 8, type: "original" }),
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
  const ecosystem = buildArtHomeEcosystemCards(services.ecosystem.crossProductLinks());
  const galleries = buildArtHomeGalleryCards(venuesResult);

  const sectionErrors: ArtHomeSection[] = [];
  if (artworks.status === "rejected") sectionErrors.push("artworks");
  if (artists.status === "rejected") sectionErrors.push("artists");

  // Curators' picks keeps its inline error / empty state; the guide promo and closing CTA are static copy.
  const visible: Record<ArtHomeSectionId, boolean> = {
    "whats-on": whatsOn.length > 0,
    "curators-picks": true,
    "featured-artists": featuredArtists.length > 0,
    ecosystem: ecosystem.length > 0,
    stories: stories.length > 0,
    guide: true,
    galleries: galleries.length > 0,
    "closing-cta": true,
  };

  return {
    sections: (Object.keys(visible) as ArtHomeSectionId[]).filter((id) => visible[id]),
    hero: editorial.kind === "ok" ? editorial.hero : null,
    whatsOn,
    featuredArtworks:
      artworks.status === "fulfilled"
        ? buildCatalogueArtworkCards(artworks.value.items, favorites.savedArtworkSlugs)
        : [],
    featuredArtists,
    ecosystem,
    stories,
    guidePromo: buildArtHomeGuidePromoVm(editorial.kind === "ok" ? editorial.guide : []),
    galleries,
    viewer: favorites.viewer,
    favoriteAuth: favorites.favoriteAuth,
    sectionErrors,
  };
}
