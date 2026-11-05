import type {
  ArtEditorialPlacement,
  ArtEditorialStorySummary,
} from "@/lib/editorial/art-editorial.types";
import { describe, expect, it } from "vitest";
import {
  HOME_STORIES_LIMIT,
  buildHomeStoryCards,
  homeReadingTime,
  homeStoryKindLabel,
} from "./art-home-stories.vm.js";

function story(
  slug: string,
  overrides: Partial<ArtEditorialStorySummary> = {},
): ArtEditorialStorySummary {
  return {
    slug,
    kind: "article",
    title: `Story ${slug}`,
    standfirst: null,
    coverUrl: `https://cdn.test/${slug}.jpg`,
    featured: true,
    readMinutes: 4,
    ...overrides,
  };
}

function placement(
  position: number,
  overrides: Partial<ArtEditorialPlacement> = {},
): ArtEditorialPlacement {
  return {
    slot: "home_stories",
    position,
    headline: null,
    mediaUrl: null,
    linkUrl: null,
    refKind: "story",
    refSlug: `s${position}`,
    ...overrides,
  };
}

describe("homeStoryKindLabel", () => {
  it("calls an article a Story and an artist interview an Interview", () => {
    expect(homeStoryKindLabel({ kind: "article" })).toBe("Story");
    expect(homeStoryKindLabel({ kind: "article", category: "artist_interview" })).toBe("Interview");
    expect(homeStoryKindLabel({ kind: "article", category: "artist_conversation" })).toBe(
      "Interview",
    );
    expect(homeStoryKindLabel({ kind: "film" })).toBe("Film");
  });
});

describe("homeReadingTime", () => {
  it("says the minutes, or nothing when unknown", () => {
    expect(homeReadingTime(4)).toBe("4 min read");
    expect(homeReadingTime(null)).toBeNull();
    expect(homeReadingTime(0)).toBeNull();
  });
});

describe("buildHomeStoryCards", () => {
  it("builds a card with the kind, title, reading time and cover", () => {
    const cards = buildHomeStoryCards({
      placements: [placement(0, { refSlug: "welcome" })],
      stories: [story("welcome")],
    });
    expect(cards).toEqual([
      {
        key: "home_stories-0",
        href: "/stories/welcome",
        headline: "Story welcome",
        kicker: "Story",
        kickerDetail: "4 min read",
        meta: null,
        imageUrl: "https://cdn.test/welcome.jpg",
      },
    ]);
  });

  it("hides a story with no cover until it gets one", () => {
    const stories = [story("welcome", { coverUrl: null }), story("with-cover")];
    const placements = [
      placement(0, { refSlug: "welcome", headline: "Welcome to lax.art" }),
      placement(1, { refSlug: "with-cover" }),
    ];
    const cards = buildHomeStoryCards({ placements, stories });
    expect(cards.map((card) => card.href)).toEqual(["/stories/with-cover"]);
    expect(cards.every((card) => card.imageUrl)).toBe(true);
  });

  it("shows a story once it has a cover", () => {
    const placements = [placement(0, { refSlug: "welcome" })];
    expect(
      buildHomeStoryCards({ placements, stories: [story("welcome", { coverUrl: null })] }),
    ).toEqual([]);
    expect(buildHomeStoryCards({ placements, stories: [story("welcome")] })).toHaveLength(1);
  });

  it("uses a curated image for a story whose own cover is missing", () => {
    const [card] = buildHomeStoryCards({
      placements: [placement(0, { refSlug: "a", mediaUrl: "https://cdn.test/curated.jpg" })],
      stories: [story("a", { coverUrl: null })],
    });
    expect(card?.imageUrl).toBe("https://cdn.test/curated.jpg");
  });

  it("leaves out a placement that is not a story and has no image", () => {
    expect(
      buildHomeStoryCards({
        placements: [placement(0, { refKind: "external", refSlug: null, headline: "Hello" })],
        stories: [],
      }),
    ).toEqual([]);
  });

  it("keeps an image-bearing placement that is not a story, as a Story card", () => {
    const [card] = buildHomeStoryCards({
      placements: [
        placement(0, {
          refKind: "external",
          refSlug: null,
          headline: "Hello",
          linkUrl: "/art-hub",
          mediaUrl: "https://cdn.test/h.jpg",
        }),
      ],
      stories: [],
    });
    expect(card).toMatchObject({
      href: "/art-hub",
      kicker: "Story",
      imageUrl: "https://cdn.test/h.jpg",
    });
  });

  it("falls back to featured stories with a cover when nothing is curated", () => {
    const cards = buildHomeStoryCards({
      placements: [],
      stories: [
        story("a"),
        story("b", { featured: false }),
        story("c", { coverUrl: null }),
        story("d", { category: "artist_interview" }),
      ],
    });
    expect(cards.map((card) => [card.href, card.kicker])).toEqual([
      ["/stories/a", "Story"],
      ["/stories/d", "Interview"],
    ]);
  });

  it("shows at most three", () => {
    const stories = ["a", "b", "c", "d", "e"].map((slug) => story(slug));
    expect(buildHomeStoryCards({ placements: [], stories })).toHaveLength(HOME_STORIES_LIMIT);
  });
});
