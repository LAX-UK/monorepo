import type { ArtEditorialPlacement } from "@/lib/editorial/art-editorial.types";
import { describe, expect, it } from "vitest";
import {
  buildPlacementCards,
  exhibitionCard,
  formatExhibitionDates,
  placementHref,
  storyCard,
  venueKickerLabel,
} from "./editorial-card.vm.js";

function placement(overrides: Partial<ArtEditorialPlacement> = {}): ArtEditorialPlacement {
  return {
    slot: "home_whats_on",
    position: 0,
    headline: "Summer show",
    mediaUrl: null,
    linkUrl: null,
    refKind: "exhibition",
    refSlug: "summer-show",
    ...overrides,
  };
}

describe("placementHref", () => {
  it("prefers a safe explicit link", () => {
    expect(placementHref(placement({ linkUrl: "https://thelax.com/x" }))).toBe(
      "https://thelax.com/x",
    );
  });

  it("ignores unsafe links and falls back to the referenced entity", () => {
    expect(placementHref(placement({ linkUrl: "javascript:alert(1)" }))).toBe(
      "/exhibitions/summer-show",
    );
    expect(placementHref(placement({ refKind: "story", refSlug: "a b" }))).toBe("/stories/a%20b");
    expect(placementHref(placement({ refKind: "venue", refSlug: "mayfair" }))).toBe(
      "/visit/mayfair",
    );
    expect(placementHref(placement({ refKind: "page", refSlug: "how-to-sell" }))).toBe(
      "/how-to-sell",
    );
    expect(placementHref(placement({ refKind: "page", refSlug: "art-advisory" }))).toBe(
      "/collector-hub/art-advisory",
    );
  });

  it("returns null when there is nothing to link to", () => {
    expect(placementHref(placement({ refKind: "external", refSlug: null }))).toBeNull();
  });
});

describe("buildPlacementCards", () => {
  it("filters by slot, orders by position and falls back on blank headlines", () => {
    const cards = buildPlacementCards(
      [
        placement({ position: 2, headline: "Second" }),
        placement({ slot: "home_hero", position: 0 }),
        placement({ position: 1, headline: "  ", mediaUrl: "https://cdn.test/a.jpg" }),
      ],
      "home_whats_on",
      "Featured",
    );
    expect(cards.map((card) => card.headline)).toEqual(["Featured", "Second"]);
    expect(cards[0]).toMatchObject({ kicker: "Exhibition", imageUrl: "https://cdn.test/a.jpg" });
  });
});

describe("formatExhibitionDates", () => {
  it("formats ranges within and across years", () => {
    expect(formatExhibitionDates("2026-03-12", "2026-05-04")).toBe("12 Mar – 4 May 2026");
    expect(formatExhibitionDates("2025-12-01", "2026-01-15")).toBe("1 Dec 2025 – 15 Jan 2026");
  });

  it("handles open-ended, single-day and invalid dates", () => {
    expect(formatExhibitionDates("2026-03-12", null)).toBe("From 12 Mar 2026");
    expect(formatExhibitionDates(null, "2026-05-04")).toBe("Until 4 May 2026");
    expect(formatExhibitionDates("2026-03-12", "2026-03-12")).toBe("12 Mar 2026");
    expect(formatExhibitionDates("soon", null)).toBeNull();
  });
});

describe("summary cards", () => {
  it("maps exhibitions and stories to linked cards", () => {
    expect(
      exhibitionCard({
        slug: "summer-show",
        kind: "event",
        title: "Summer show",
        summary: null,
        startsOn: "2026-06-01",
        endsOn: null,
        coverUrl: null,
        featured: false,
      }),
    ).toMatchObject({ href: "/exhibitions/summer-show", kicker: "Event", meta: "From 1 Jun 2026" });
    expect(
      exhibitionCard({
        slug: "venue-show",
        kind: "exhibition",
        title: "Venue show",
        summary: null,
        startsOn: null,
        endsOn: null,
        coverUrl: null,
        featured: false,
        venue: { slug: "marylebone", name: "LAX Marylebone" },
      }),
    ).toMatchObject({ kicker: "Exhibition", kickerDetail: "LAX Marylebone" });
    expect(
      storyCard({
        slug: "studio-visit",
        kind: "film",
        title: "Studio visit",
        standfirst: "Inside the studio",
        coverUrl: "https://cdn.test/s.jpg",
        featured: true,
      }),
    ).toMatchObject({ href: "/stories/studio-visit", kicker: "Film", meta: "Inside the studio" });
  });
});

describe("venueKickerLabel", () => {
  it("prefers the city, then the venue name, and is null without a venue", () => {
    expect(venueKickerLabel({ name: "LAX Marylebone", city: "London" })).toBe("London");
    expect(venueKickerLabel({ name: "LAX Marylebone", city: " " })).toBe("LAX Marylebone");
    expect(venueKickerLabel({ name: "LAX Marylebone" })).toBe("LAX Marylebone");
    expect(venueKickerLabel(null)).toBeNull();
    expect(venueKickerLabel(undefined)).toBeNull();
  });

  it("feeds the exhibition card kicker detail", () => {
    expect(
      exhibitionCard({
        slug: "s",
        kind: "exhibition",
        title: "S",
        summary: null,
        startsOn: null,
        endsOn: null,
        coverUrl: null,
        featured: false,
        venue: { slug: "m", name: "LAX Marylebone", city: "London" },
      }).kickerDetail,
    ).toBe("London");
  });
});
