import type {
  ArtEditorialExhibitionSummary,
  ArtEditorialStorySummary,
} from "@/lib/editorial/art-editorial.types";
import { describe, expect, it } from "vitest";
import {
  STORIES_TABS,
  filterStoriesForTab,
  formatStoryDate,
  newestFirst,
  readMinutesLabel,
  selectRelatedContent,
  storiesTab,
  storyByline,
  storyFeatureCard,
  tabOfStory,
} from "./editorial-story.vm.js";

function story(overrides: Partial<ArtEditorialStorySummary> = {}): ArtEditorialStorySummary {
  return {
    slug: "studio",
    kind: "article",
    title: "In the studio",
    standfirst: null,
    coverUrl: null,
    featured: false,
    publishedAt: "2026-10-21T18:00:00.000Z",
    ...overrides,
  };
}

function exhibition(
  overrides: Partial<ArtEditorialExhibitionSummary> = {},
): ArtEditorialExhibitionSummary {
  return {
    slug: "new-originals",
    kind: "exhibition",
    title: "New Originals",
    summary: null,
    startsOn: "2026-10-01",
    endsOn: "2026-12-01",
    coverUrl: null,
    featured: false,
    ...overrides,
  };
}

describe("story formatting", () => {
  it("formats dates in UTC and tolerates missing or invalid input", () => {
    expect(formatStoryDate("2026-10-21T23:30:00.000Z")).toBe("21 Oct 2026");
    expect(formatStoryDate(null)).toBeNull();
    expect(formatStoryDate("not a date")).toBeNull();
  });

  it("labels read time only when known", () => {
    expect(readMinutesLabel(4)).toBe("4 MIN READ");
    expect(readMinutesLabel(0)).toBeNull();
    expect(readMinutesLabel(null)).toBeNull();
  });

  it("builds the byline from author and date", () => {
    expect(storyByline({ authorName: "Clara Hutchins", publishedAt: "2026-10-21T00:00:00Z" })).toBe(
      "By Clara Hutchins · 21 Oct 2026",
    );
    expect(storyByline({ authorName: " ", publishedAt: "2026-10-21T00:00:00Z" })).toBe(
      "21 Oct 2026",
    );
    expect(storyByline({ authorName: "Clara Hutchins" })).toBe("By Clara Hutchins");
    expect(storyByline({})).toBeNull();
  });

  it("composes the hub kicker with read time and the index kicker with the date", () => {
    const item = story({ category: "artist_interview", readMinutes: 6 });
    expect(storyFeatureCard(item, "read")).toMatchObject({
      kicker: "Artist interview",
      kickerDetail: "6 MIN READ",
    });
    expect(storyFeatureCard(item, "date")).toMatchObject({
      kicker: "Artist interview",
      kickerDetail: "21 Oct 2026",
    });
    expect(storyFeatureCard(story({ publishedAt: null }), "date").kickerDetail).toBeNull();
  });
});

describe("stories tabs", () => {
  it("maps each tab to a route segment and the API filter it can use", () => {
    expect(STORIES_TABS.map((tab) => [tab.id, tab.href, tab.query])).toEqual([
      ["all", "/stories", {}],
      ["artists", "/stories/artists", {}],
      ["podcast", "/stories/podcast", { kind: "podcast" }],
      ["press", "/stories/press", { kind: "press" }],
    ]);
    expect(storiesTab("press").label).toBe("Press");
  });

  it("places a story by format first, then by category", () => {
    expect(tabOfStory({ kind: "podcast", category: "article" })).toBe("podcast");
    expect(tabOfStory({ kind: "press" })).toBe("press");
    expect(tabOfStory({ kind: "article", category: "studio_visit" })).toBe("artists");
    expect(tabOfStory({ kind: "film" })).toBe("artists");
  });

  it("narrows stories to a tab, keeping all of them on All", () => {
    const items = [
      story({ slug: "a" }),
      story({ slug: "b", kind: "podcast" }),
      story({ slug: "c", kind: "press" }),
    ];
    expect(filterStoriesForTab("all", items)).toHaveLength(3);
    expect(filterStoriesForTab("artists", items).map((s) => s.slug)).toEqual(["a"]);
    expect(filterStoriesForTab("podcast", items).map((s) => s.slug)).toEqual(["b"]);
  });

  it("sorts newest first with undated stories last", () => {
    const sorted = newestFirst([
      story({ slug: "old", publishedAt: "2026-01-01T00:00:00Z" }),
      story({ slug: "none", publishedAt: null }),
      story({ slug: "new", publishedAt: "2026-09-01T00:00:00Z" }),
    ]);
    expect(sorted.map((s) => s.slug)).toEqual(["new", "old", "none"]);
  });
});

describe("selectRelatedContent", () => {
  const now = new Date("2026-10-21T12:00:00Z");

  it("prefers a current or upcoming exhibition over related stories", () => {
    const result = selectRelatedContent({
      exhibitions: [exhibition()],
      storyGroups: [[story({ slug: "other" })]],
      currentSlug: "studio",
      now,
    });
    expect(result).toMatchObject({
      kind: "exhibitions",
      heading: "Related exhibitions",
      cards: [{ href: "/exhibitions/new-originals" }],
    });
  });

  it("ignores exhibitions that have ended and falls back to stories", () => {
    const result = selectRelatedContent({
      exhibitions: [exhibition({ endsOn: "2026-01-01" })],
      storyGroups: [[story({ slug: "other" })]],
      currentSlug: "studio",
      now,
    });
    expect(result).toMatchObject({ kind: "stories", heading: "Related stories" });
  });

  it("uses the first story group that has another story, never the article itself", () => {
    const result = selectRelatedContent({
      exhibitions: [],
      storyGroups: [[story({ slug: "studio" })], [story({ slug: "studio" }), story({ slug: "x" })]],
      currentSlug: "studio",
      now,
    });
    expect(result?.cards.map((card) => card.key)).toEqual(["x"]);
  });

  it("limits the list to three and offers nothing when nothing relates", () => {
    const many = ["a", "b", "c", "d"].map((slug) => story({ slug }));
    expect(
      selectRelatedContent({ exhibitions: [], storyGroups: [many], currentSlug: "z", now })?.cards,
    ).toHaveLength(3);
    expect(
      selectRelatedContent({ exhibitions: [], storyGroups: [], currentSlug: "z", now }),
    ).toBeNull();
  });
});
