import type {
  ArtEditorialPlacement,
  ArtEditorialStoryDetail,
  ArtEditorialStorySummary,
} from "@/lib/editorial/art-editorial.types";
import { describe, expect, it } from "vitest";
import {
  artistIntro,
  buildArtHubHeroLinks,
  buildHubFilm,
  buildHubPodcast,
  buildHubPressRows,
  placedStorySlug,
} from "./art-hub.vm.js";

function detail(overrides: Partial<ArtEditorialStoryDetail> = {}): ArtEditorialStoryDetail {
  return {
    slug: "studio-light",
    kind: "podcast",
    title: "Studio light",
    standfirst: "Chasing daylight.",
    coverUrl: "/cover.webp",
    featured: false,
    videoUrl: null,
    body: [],
    audioUrl: "https://media.example/a.mp3",
    durationSeconds: 2778,
    ...overrides,
  };
}

describe("buildHubPodcast", () => {
  it("builds the panel from an episode with playable audio", () => {
    expect(buildHubPodcast(detail())).toEqual({
      title: "Studio light",
      description: "Chasing daylight.",
      href: "/stories/studio-light",
      imageUrl: "/cover.webp",
      audioUrl: "https://media.example/a.mp3",
      durationSeconds: 2778,
    });
  });

  it("hides the panel without audio, or with audio that is not https", () => {
    expect(buildHubPodcast(detail({ audioUrl: null }))).toBeNull();
    expect(buildHubPodcast(detail({ audioUrl: "http://media.example/a.mp3" }))).toBeNull();
    expect(buildHubPodcast(detail({ audioUrl: "javascript:alert(1)" }))).toBeNull();
    expect(buildHubPodcast(null)).toBeNull();
  });
});

describe("buildHubFilm", () => {
  it("needs a hosted https film", () => {
    expect(
      buildHubFilm(detail({ kind: "film", videoUrl: "https://vimeo.example/1" })),
    ).toMatchObject({ videoUrl: "https://vimeo.example/1", href: "/stories/studio-light" });
    expect(buildHubFilm(detail({ kind: "film", videoUrl: null }))).toBeNull();
  });

  it("carries the standfirst as the film's description", () => {
    expect(
      buildHubFilm(detail({ kind: "film", videoUrl: "https://vimeo.example/1", standfirst: " " })),
    ).toMatchObject({ description: null });
  });
});

describe("buildArtHubHeroLinks", () => {
  it("adds Watch, pointing at the film, only when a film is published", () => {
    expect(buildArtHubHeroLinks(null).map((link) => link.label)).toEqual([
      "Explore artists",
      "Exhibitions",
      "All stories",
    ]);
    expect(buildArtHubHeroLinks({ href: "/stories/studio" }).at(-1)).toEqual({
      label: "Watch",
      href: "/stories/studio",
    });
  });
});

describe("artistIntro", () => {
  it("prefers the short biography, then the biography's first sentence", () => {
    expect(artistIntro({ shortBio: " Paints light. ", bio: "Long bio." })).toBe("Paints light.");
    expect(artistIntro({ bio: "Born in Lagos. Works in London." })).toBe("Born in Lagos.");
    expect(artistIntro({ bio: "No full stop here" })).toBe("No full stop here");
    expect(artistIntro({ shortBio: null, bio: "  " })).toBeNull();
  });
});

describe("buildHubPressRows", () => {
  const press = (overrides: Partial<ArtEditorialStorySummary>): ArtEditorialStorySummary => ({
    slug: "review",
    kind: "press",
    title: "A review",
    standfirst: null,
    coverUrl: null,
    featured: false,
    publishedAt: "2026-09-12T00:00:00.000Z",
    publicationName: "Art Plugged",
    externalUrl: "https://example.com/review",
    ...overrides,
  });

  it("links to the original article (through the safe-link component), showing outlet and date", () => {
    expect(buildHubPressRows([press({})])).toEqual([
      {
        key: "review",
        title: "A review",
        publication: "Art Plugged",
        date: "12 Sept 2026",
        href: "https://example.com/review",
      },
    ]);
  });

  it("falls back to the story page without a safe external link", () => {
    const [row] = buildHubPressRows([press({ externalUrl: null, publicationName: " " })]);
    expect(row).toMatchObject({ href: "/stories/review", publication: null });
  });
});

describe("placedStorySlug", () => {
  const placement = (overrides: Partial<ArtEditorialPlacement>): ArtEditorialPlacement => ({
    slot: "art_hub_podcast",
    position: 0,
    headline: null,
    mediaUrl: null,
    linkUrl: null,
    refKind: "story",
    refSlug: "ep-1",
    ...overrides,
  });

  it("takes the first story placed in the slot and ignores other slots and kinds", () => {
    expect(
      placedStorySlug(
        [
          placement({ position: 2, refSlug: "ep-3" }),
          placement({ position: 1, refSlug: "ep-2" }),
          placement({ slot: "art_hub_films", refSlug: "film" }),
          placement({ refKind: "exhibition", position: 0, refSlug: "show" }),
        ],
        "art_hub_podcast",
      ),
    ).toBe("ep-2");
    expect(placedStorySlug([], "art_hub_podcast")).toBeNull();
  });
});
