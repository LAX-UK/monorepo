import { describe, expect, it } from "vitest";
import type { ArtEditorialPlacement } from "./art-editorial.types.js";
import { guideCard, hubFeatureCards } from "./hub-card.vm.js";

function placement(overrides: Partial<ArtEditorialPlacement> = {}): ArtEditorialPlacement {
  return {
    slot: "collector_hub_card",
    position: 0,
    headline: "Private sales",
    body: "Works presented privately.",
    ctaLabel: "Find out more",
    mediaUrl: "/a.webp",
    linkUrl: null,
    refKind: "page",
    refSlug: "private-sales",
    ...overrides,
  };
}

describe("hubFeatureCards", () => {
  it("keeps only hub cards, in position order, with body, label and link", () => {
    const cards = hubFeatureCards([
      placement({ position: 2, headline: "Second", refSlug: "second" }),
      placement({ slot: "home_hero", headline: "Not a hub card" }),
      placement({ position: 1, headline: "First", refSlug: "first", ctaLabel: " " }),
    ]);
    expect(cards.map((card) => card.title)).toEqual(["First", "Second"]);
    expect(cards[0]).toMatchObject({
      href: "/collector-hub/first",
      body: "Works presented privately.",
      ctaLabel: null,
      imageUrl: "/a.webp",
    });
    expect(cards[1]?.ctaLabel).toBe("Find out more");
  });

  it("skips untitled placements and prefers an explicit safe link", () => {
    const cards = hubFeatureCards([
      placement({ headline: null }),
      placement({ position: 1, linkUrl: "/artworks?private=1" }),
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.href).toBe("/artworks?private=1");
  });
});

describe("guideCard", () => {
  const story = {
    slug: "start",
    kind: "guide" as const,
    title: "Start here",
    standfirst: "Three checks.",
    coverUrl: null,
    featured: false,
  };

  it("labels the card LAX Guide with its read time and drops the standfirst", () => {
    expect(guideCard({ ...story, readMinutes: 4 })).toMatchObject({
      href: "/stories/start",
      kicker: "LAX Guide",
      kickerDetail: "4 min read",
      meta: null,
    });
  });

  it("omits the read time when unknown", () => {
    expect(guideCard({ ...story, readMinutes: null }).kickerDetail).toBeNull();
    expect(guideCard(story).kickerDetail).toBeNull();
  });
});
