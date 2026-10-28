import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import type {
  ArtEditorialFetchResult,
  ArtEditorialStoryDetail,
} from "@/lib/editorial/art-editorial.types";
import {
  ART_HUB_LIMITS,
  type ArtHubFilmVm,
  type ArtHubPodcastVm,
  type ArtHubPressRowVm,
  buildHubFilm,
  buildHubPodcast,
  buildHubPressRows,
  placedStorySlug,
} from "@/lib/editorial/art-hub.vm";
import { buildPlacementCards, exhibitionCard } from "@/lib/editorial/editorial-card.vm";
import type { EditorialCardVm } from "@/lib/editorial/editorial-card.vm";
import type { ArtEditorialPageResult } from "@/lib/editorial/editorial-pages.composer";
import {
  filterStoriesForTab,
  newestFirst,
  storyFeatureCard,
} from "@/lib/editorial/editorial-story.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import { curatedOrNewest } from "@/lib/home/home-page.composer";
import type {
  ArtCataloguePort,
  ArtEcosystemPort,
  ArtEditorialPort,
  ArtFavoritesReadPort,
  ArtViewerPort,
} from "@/lib/ports";
import { buildArtProductDoors } from "@/lib/product-doors/art-product-doors.vm";
import type { MarketingProductDoorVm } from "@auction/marketing-ui";

/** Sections in Figma order (Arthub `980:26767`). */
export type ArtHubSectionId =
  | "hero"
  | "now-on"
  | "stories"
  | "spotlight"
  | "podcast"
  | "films"
  | "collecting"
  | "press"
  | "product-doors";

export type ArtHubPageVm = {
  /** Visible sections in render order; a section with no data is left out. */
  sections: ArtHubSectionId[];
  heroImageUrl: string | null;
  nowOn: EditorialCardVm[];
  stories: EditorialCardVm[];
  artists: CatalogueArtistCardVm[];
  favoriteAuth: ArtFavoriteAuth;
  podcast: ArtHubPodcastVm | null;
  film: ArtHubFilmVm | null;
  press: ArtHubPressRowVm[];
  productDoors: MarketingProductDoorVm[];
};

type ArtHubServices = {
  catalogue: Pick<ArtCataloguePort, "listArtists">;
  viewer: ArtViewerPort;
  favorites: ArtFavoritesReadPort;
  editorial: Pick<ArtEditorialPort, "home" | "listExhibitions" | "listStories" | "getStory">;
  ecosystem: ArtEcosystemPort;
};

const SPOTLIGHT_ARTISTS = 2;

function okItems<T>(result: ArtEditorialFetchResult<{ items: T[] }>): T[] {
  return result.status === "ok" ? result.data.items : [];
}

/** The story a curator placed in a slot, else the newest of the kind; null when neither exists. */
async function loadFeaturedStory(
  editorial: Pick<ArtEditorialPort, "getStory">,
  placedSlug: string | null,
  newestSlug: string | undefined,
): Promise<ArtEditorialStoryDetail | null> {
  const slug = placedSlug ?? newestSlug;
  if (!slug) return null;
  const result = await editorial.getStory(slug);
  return result.status === "ok" ? result.data : null;
}

export async function composeArtHubPage(
  services: ArtHubServices,
): Promise<ArtEditorialPageResult<ArtHubPageVm>> {
  const { editorial } = services;
  const [home, current, allStories, podcasts, films, press, artists, favorites] = await Promise.all(
    [
      editorial.home(),
      editorial.listExhibitions("current"),
      editorial.listStories(),
      editorial.listStories({ kind: "podcast" }),
      editorial.listStories({ kind: "film" }),
      editorial.listStories({ kind: "press" }),
      curatedOrNewest(
        () =>
          services.catalogue.listArtists({
            limit: SPOTLIGHT_ARTISTS,
            placement: "featured_artists",
          }),
        () => services.catalogue.listArtists({ limit: SPOTLIGHT_ARTISTS }),
      ).catch(() => ({ items: [] })),
      loadViewerFavoriteContext(services, "/art-hub", { followedArtists: true }),
    ],
  );
  if (home.status !== "ok" && allStories.status !== "ok") return home;

  const placements = home.status === "ok" ? home.data.placements : [];
  const [podcastStory, filmStory] = await Promise.all([
    loadFeaturedStory(
      editorial,
      placedStorySlug(placements, "art_hub_podcast"),
      newestFirst(okItems(podcasts))[0]?.slug,
    ),
    loadFeaturedStory(
      editorial,
      placedStorySlug(placements, "art_hub_films"),
      newestFirst(okItems(films))[0]?.slug,
    ),
  ]);

  const placedNowOn = buildPlacementCards(placements, "art_hub_now_on", "Now on");
  const nowOn = (placedNowOn.length > 0 ? placedNowOn : okItems(current).map(exhibitionCard)).slice(
    0,
    ART_HUB_LIMITS.nowOn,
  );
  const stories = filterStoriesForTab("artists", newestFirst(okItems(allStories)))
    .slice(0, ART_HUB_LIMITS.stories)
    .map((story) => storyFeatureCard(story, "read"));
  const artistCards = buildCatalogueArtistCards(artists.items, favorites.followedArtistSlugs);
  const podcast = buildHubPodcast(podcastStory);
  const film = buildHubFilm(filmStory);
  const pressRows = buildHubPressRows(newestFirst(okItems(press)).slice(0, ART_HUB_LIMITS.press));
  const productDoors = buildArtProductDoors(services.ecosystem.crossProductLinks(), placements);

  // Copy-only panels (hero, Collecting 101) always show; the rest need data.
  const visible: Record<ArtHubSectionId, boolean> = {
    hero: true,
    "now-on": nowOn.length > 0,
    stories: stories.length > 0,
    spotlight: artistCards.length > 0,
    podcast: podcast !== null,
    films: film !== null,
    collecting: true,
    press: pressRows.length > 0,
    "product-doors": productDoors.length > 0,
  };

  return {
    status: "ok",
    data: {
      sections: (Object.keys(visible) as ArtHubSectionId[]).filter((id) => visible[id]),
      heroImageUrl: nowOn.find((card) => card.imageUrl)?.imageUrl ?? null,
      nowOn,
      stories,
      artists: artistCards,
      favoriteAuth: favorites.favoriteAuth,
      podcast,
      film,
      press: pressRows,
      productDoors,
    },
  };
}
