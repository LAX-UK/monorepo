import { artistHref } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type {
  ArtEditorialFetchResult,
  ArtEditorialStoryDetail,
  ArtEditorialStorySummary,
} from "@/lib/editorial/art-editorial.types";
import {
  ART_HUB_LIMITS,
  type ArtHubFilmVm,
  type ArtHubHeroLinkVm,
  type ArtHubPodcastVm,
  type ArtHubPressRowVm,
  type ArtHubSpotlightVm,
  artistIntro,
  buildArtHubHeroLinks,
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
import { curatedOrNewest } from "@/lib/home/home-page.composer";
import type { ArtCataloguePort, ArtEcosystemPort, ArtEditorialPort } from "@/lib/ports";
import { buildArtProductDoors } from "@/lib/product-doors/art-product-doors.vm";
import {
  type MarketingBandSection,
  type MarketingProductDoorVm,
  type MarketingSectionSurface,
  marketingArtistFactsLine,
  resolveBandSequence,
} from "@auction/marketing-ui";
import type { PublicArtistDetail, PublicArtistSummary } from "@auction/shop-contracts";

/**
 * Sections in render order: Figma's (Arthub `980:26767`), except that Collecting 101 follows the
 * press band, so the podcast and Collecting 101 splits never sit one after the other.
 */
export type ArtHubSectionId =
  | "hero"
  | "now-on"
  | "stories"
  | "spotlight"
  | "podcast"
  | "films"
  | "press"
  | "collecting"
  | "product-doors";

export type ArtHubPageVm = {
  /** Visible sections in render order; a section with no data is left out. */
  sections: ArtHubSectionId[];
  /** The surface each visible section gets, so two tinted bands never sit side by side. */
  surfaces: Partial<Record<ArtHubSectionId, MarketingSectionSurface>>;
  hero: { imageUrl: string | null; links: ArtHubHeroLinkVm[] };
  nowOn: EditorialCardVm[];
  stories: EditorialCardVm[];
  spotlight: ArtHubSpotlightVm[];
  podcast: ArtHubPodcastVm | null;
  film: ArtHubFilmVm | null;
  /** The guide's cover beside Collecting 101; without one the panel centres its copy. */
  collectingImageUrl: string | null;
  press: ArtHubPressRowVm[];
  productDoors: MarketingProductDoorVm[];
};

type ArtHubServices = {
  catalogue: Pick<ArtCataloguePort, "listArtists" | "getArtist">;
  editorial: Pick<ArtEditorialPort, "home" | "listExhibitions" | "listStories" | "getStory">;
  ecosystem: ArtEcosystemPort;
};

/**
 * The surface each section asks for. Podcast and Collecting 101 are cream panels that can also
 * sit on the page; press is the fixed inverse band.
 */
const SECTION_SURFACE: Record<
  ArtHubSectionId,
  Pick<MarketingBandSection<ArtHubSectionId>, "surface" | "flexible">
> = {
  hero: { surface: "plain", flexible: false },
  "now-on": { surface: "plain", flexible: false },
  stories: { surface: "plain", flexible: false },
  spotlight: { surface: "plain", flexible: false },
  podcast: { surface: "band", flexible: true },
  films: { surface: "plain", flexible: false },
  collecting: { surface: "band", flexible: true },
  press: { surface: "band", flexible: false },
  "product-doors": { surface: "plain", flexible: false },
};

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

/** Curated spotlight artists with their profile, so each card can introduce the artist. */
async function loadSpotlight(catalogue: ArtHubServices["catalogue"]): Promise<ArtHubSpotlightVm[]> {
  const list = await curatedOrNewest(
    () => catalogue.listArtists({ limit: SPOTLIGHT_CANDIDATES, placement: "featured_artists" }),
    () => catalogue.listArtists({ limit: SPOTLIGHT_CANDIDATES }),
  ).catch(() => ({ items: [] as PublicArtistSummary[] }));
  const chosen = pickSpotlightArtists(list.items);
  const details = await Promise.all(
    chosen.map((artist) => catalogue.getArtist(artist.slug).catch(() => null)),
  );
  return chosen.map((artist, index) => spotlightCard(artist, details[index] ?? null));
}

/** Candidates read for the spotlight, so artists with a portrait can be preferred. */
const SPOTLIGHT_CANDIDATES = 8;

/**
 * The spotlight is a portrait feature: it shows artists with a portrait, in curated order. Only
 * when nobody has one does it fall back to the artists as listed (cards without an image).
 */
export function pickSpotlightArtists<T extends { portraitUrl: string | null }>(
  artists: readonly T[],
): T[] {
  const withPortrait = artists.filter((artist) => artist.portraitUrl);
  return (withPortrait.length > 0 ? withPortrait : artists).slice(0, ART_HUB_LIMITS.spotlight);
}

function spotlightCard(
  artist: PublicArtistSummary,
  detail: PublicArtistDetail | null,
): ArtHubSpotlightVm {
  return {
    slug: artist.slug,
    name: artist.name,
    href: artistHref(artist.slug),
    imageUrl: artist.portraitUrl,
    imageAlt: `Portrait of ${artist.name}`,
    caption: marketingArtistFactsLine({
      nationality: detail?.nationality ?? null,
      birthYear: detail?.birthYear ?? null,
      deathYear: detail?.deathYear ?? null,
      discipline: artist.discipline,
    }),
    intro: detail ? artistIntro(detail) : null,
  };
}

/** A view of the gallery, the Figma hero's subject, when no curator has placed an image. */
export const ART_HUB_DEFAULT_HERO_IMAGE = "/art/gallery-team/gallery.webp";

/**
 * The hero image: the curator's Art Hub feature image, else the view of the gallery; never one a
 * card below repeats, so the page does not open with the same picture twice. Null centres the
 * hero's copy.
 */
function pickHeroImage(
  candidates: readonly (string | null)[],
  usedBelow: ReadonlySet<string>,
): string | null {
  return candidates.find((url): url is string => url !== null && !usedBelow.has(url)) ?? null;
}

function guideCover(stories: readonly ArtEditorialStorySummary[]): string | null {
  return stories.find((story) => story.kind === "guide" && story.coverUrl)?.coverUrl ?? null;
}

export async function composeArtHubPage(
  services: ArtHubServices,
): Promise<ArtEditorialPageResult<ArtHubPageVm>> {
  const { editorial } = services;
  const [home, current, allStories, podcasts, films, press, spotlight] = await Promise.all([
    editorial.home(),
    editorial.listExhibitions("current"),
    editorial.listStories(),
    editorial.listStories({ kind: "podcast" }),
    editorial.listStories({ kind: "film" }),
    editorial.listStories({ kind: "press" }),
    loadSpotlight(services.catalogue),
  ]);
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
  const storySummaries = newestFirst(okItems(allStories));
  const stories = filterStoriesForTab("artists", storySummaries)
    .slice(0, ART_HUB_LIMITS.stories)
    .map((story) => storyFeatureCard(story, "read"));
  const podcast = buildHubPodcast(podcastStory);
  const film = buildHubFilm(filmStory);
  const pressRows = buildHubPressRows(newestFirst(okItems(press)).slice(0, ART_HUB_LIMITS.press));
  const productDoors = buildArtProductDoors(services.ecosystem.crossProductLinks(), placements);
  const collectingImageUrl = guideCover(storySummaries);

  // Copy-led panels (hero, Collecting 101) always show; the rest need data.
  const visible: Record<ArtHubSectionId, boolean> = {
    hero: true,
    "now-on": nowOn.length > 0,
    stories: stories.length > 0,
    spotlight: spotlight.length > 0,
    podcast: podcast !== null,
    films: film !== null,
    press: pressRows.length > 0,
    collecting: true,
    "product-doors": productDoors.length > 0,
  };
  const sections = (Object.keys(visible) as ArtHubSectionId[]).filter((id) => visible[id]);

  const imagesBelow = new Set(
    [...nowOn, ...stories]
      .map((card) => card.imageUrl)
      .concat(podcast?.imageUrl ?? null, film?.imageUrl ?? null, collectingImageUrl)
      .filter((url): url is string => Boolean(url)),
  );
  const placedHero = buildPlacementCards(placements, "art_hub_feature", "Art Hub")[0]?.imageUrl;
  const heroCandidates = [placedHero ?? null, ART_HUB_DEFAULT_HERO_IMAGE];

  return {
    status: "ok",
    data: {
      sections,
      surfaces: resolveBandSequence(sections.map((id) => ({ id, ...SECTION_SURFACE[id] }))),
      hero: {
        imageUrl: pickHeroImage(heroCandidates, imagesBelow),
        links: buildArtHubHeroLinks(film),
      },
      nowOn,
      stories,
      spotlight,
      podcast,
      film,
      collectingImageUrl,
      press: pressRows,
      productDoors,
    },
  };
}
