import type {
  ArtEditorialPlacement,
  ArtEditorialStoryDetail,
  ArtEditorialStorySummary,
} from "@/lib/editorial/art-editorial.types";
import { formatStoryDate } from "@/lib/editorial/editorial-story.vm";
import { isSafeEditorialHref } from "@auction/shop-contracts";

/** Product-owned hero copy (Figma Arthub `983:27033`). */
export const ART_HUB_HERO = {
  eyebrow: "Art Hub",
  title: "Inside the world of LAX",
  body: "Artists, ideas, exhibitions and the stories unfolding in and around the gallery.",
  linksLabel: "Explore the Art Hub",
} as const;

export type ArtHubHeroLinkVm = { label: string; href: string };

const HERO_LINKS: readonly ArtHubHeroLinkVm[] = [
  { label: "Explore artists", href: "/artists" },
  { label: "Exhibitions", href: "/exhibitions" },
  { label: "All stories", href: "/stories" },
];

/** The hero's links; "Watch" joins them only when a film is published, so it never leads nowhere. */
export function buildArtHubHeroLinks(film: Pick<ArtHubFilmVm, "href"> | null): ArtHubHeroLinkVm[] {
  return film ? [...HERO_LINKS, { label: "Watch", href: film.href }] : [...HERO_LINKS];
}

export const ART_HUB_HEADINGS = {
  nowOn: "Happening now in the gallery",
  nowOnSubtitle: "Current exhibitions and presentations at the gallery.",
  stories: "Ways of seeing",
  storiesSubtitle: "Stories from where we stand: the artists, studios and ideas behind the work.",
  spotlight: "In the spotlight",
  films: "Films",
  press: "Press",
} as const;

/** Collecting 101 panel (Figma Arthub `999:15936`). */
export const ART_HUB_COLLECTING = {
  title: "A clearer way to begin",
  body: "Collecting should feel considered, not intimidating. Our guide walks you through finding, understanding and buying original art.",
  cta: { label: "Start Collecting 101", href: "/collector-hub/101-guide" },
} as const;

export const ART_HUB_LIMITS = { nowOn: 6, stories: 8, press: 5, spotlight: 2 } as const;

export type ArtHubSpotlightVm = {
  slug: string;
  name: string;
  href: string;
  imageUrl: string | null;
  imageAlt: string;
  /** Nationality, years and discipline; null hides the line. */
  caption: string | null;
  /** The short biography, else the biography's first sentence; null hides it. */
  intro: string | null;
};

/** Re-exported for the Art Hub spotlight; the rule lives with the artist profile. */
export { artistIntro } from "@/lib/artist/artist-profile.vm";

function httpsUrl(value: string | null | undefined): string | null {
  return value && isSafeEditorialHref(value) && value.startsWith("https://") ? value : null;
}

/** The slug a curator placed in `slot`, if any. */
export function placedStorySlug(
  placements: readonly ArtEditorialPlacement[],
  slot: ArtEditorialPlacement["slot"],
): string | null {
  return (
    placements
      .filter((placement) => placement.slot === slot && placement.refKind === "story")
      .sort((a, b) => a.position - b.position)[0]?.refSlug ?? null
  );
}

export type ArtHubPodcastVm = {
  title: string;
  description: string | null;
  href: string;
  imageUrl: string | null;
  audioUrl: string;
  durationSeconds: number | null;
};

/** Null without a playable https audio file, so the panel is hidden rather than silent. */
export function buildHubPodcast(story: ArtEditorialStoryDetail | null): ArtHubPodcastVm | null {
  const audioUrl = httpsUrl(story?.audioUrl);
  if (!story || !audioUrl) return null;
  return {
    title: story.title,
    description: story.standfirst,
    href: `/stories/${encodeURIComponent(story.slug)}`,
    imageUrl: story.coverUrl,
    audioUrl,
    durationSeconds: story.durationSeconds ?? null,
  };
}

export type ArtHubFilmVm = {
  title: string;
  /** The film's standfirst; null hides the line. */
  description: string | null;
  href: string;
  imageUrl: string | null;
  videoUrl: string;
};

/** Null without a hosted https film, which is what the poster links out to. */
export function buildHubFilm(story: ArtEditorialStoryDetail | null): ArtHubFilmVm | null {
  const videoUrl = httpsUrl(story?.videoUrl);
  if (!story || !videoUrl) return null;
  return {
    title: story.title,
    description: story.standfirst?.trim() || null,
    href: `/stories/${encodeURIComponent(story.slug)}`,
    imageUrl: story.coverUrl,
    videoUrl,
  };
}

export type ArtHubPressRowVm = {
  key: string;
  title: string;
  publication: string | null;
  date: string | null;
  /** The original article when the story links out, otherwise the story page. */
  href: string;
};

export function buildHubPressRows(
  stories: readonly ArtEditorialStorySummary[],
): ArtHubPressRowVm[] {
  return stories.map((story) => {
    const original = httpsUrl(story.externalUrl);
    return {
      key: story.slug,
      title: story.title,
      publication: story.publicationName?.trim() || null,
      date: formatStoryDate(story.publishedAt),
      href: original ?? `/stories/${encodeURIComponent(story.slug)}`,
    };
  });
}
