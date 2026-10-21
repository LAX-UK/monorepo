import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import "./contract-formats.js";
import {
  EditorialArtistRelationsSchema,
  EditorialExhibitionDetailSchema,
  EditorialExhibitionSummarySchema,
  EditorialHomeResponseSchema,
  EditorialStoryDetailSchema,
  EditorialStoryListQuerySchema,
  EditorialStorySummarySchema,
  EditorialVenueDetailSchema,
  EditorialVenueSummarySchema,
} from "./editorial-public.js";

const exhibitionSummary = {
  slug: "new-originals",
  kind: "exhibition",
  title: "New Originals",
  summary: null,
  startsOn: "2026-10-01",
  endsOn: "2026-11-30",
  coverUrl: null,
  featured: true,
};

const storySummary = {
  slug: "welcome",
  kind: "article",
  title: "Welcome",
  standfirst: null,
  coverUrl: null,
  featured: false,
};

const exhibitionDetail = {
  ...exhibitionSummary,
  timesNote: null,
  venueSlug: "lax-marylebone",
  body: [],
  installationMedia: [],
};

const artworkSummary = {
  slug: "tidal-forms",
  title: "Tidal Forms",
  artistName: "Mara Ellison",
  artistSlug: "mara-ellison",
  imageUrl: null,
  saleState: "price_on_application",
  dimensions: null,
  dimensionsCmDisplay: null,
  medium: null,
  yearCreated: null,
  objectType: null,
  rarity: null,
  salesChannel: "art",
  eligibleForEditionAllocation: false,
  printPricePence: null,
  availability: { totalEditions: 0, editionsAvailable: 0 },
};

const artistSummary = {
  slug: "mara-ellison",
  name: "Mara Ellison",
  discipline: "Painter",
  portraitUrl: null,
  artworkCount: 2,
};

describe("editorial public contracts", () => {
  it("still parses responses from a shop-api without the relation fields", () => {
    expect(Value.Check(EditorialExhibitionSummarySchema, exhibitionSummary)).toBe(true);
    expect(Value.Check(EditorialExhibitionDetailSchema, exhibitionDetail)).toBe(true);
    expect(Value.Check(EditorialStorySummarySchema, storySummary)).toBe(true);
    expect(
      Value.Check(EditorialStoryDetailSchema, { ...storySummary, videoUrl: null, body: [] }),
    ).toBe(true);
  });

  it("parses exhibition venue, works, artists and stories", () => {
    const detail = {
      ...exhibitionDetail,
      venue: { slug: "lax-marylebone", name: "LAX Marylebone" },
      artworks: [artworkSummary],
      artists: [
        {
          ...artistSummary,
          bio: "Paints tides.",
          nationality: "British",
          birthYear: 1980,
          deathYear: null,
        },
      ],
      stories: [{ ...storySummary, publishedAt: "2026-10-01T09:00:00.000Z" }],
    };
    expect(Value.Check(EditorialExhibitionDetailSchema, detail)).toBe(true);
    expect(
      Value.Check(EditorialExhibitionSummarySchema, { ...exhibitionSummary, venue: null }),
    ).toBe(true);
  });

  it("parses story publishedAt and related content", () => {
    const detail = {
      ...storySummary,
      publishedAt: null,
      videoUrl: null,
      body: [],
      related: {
        artists: [artistSummary],
        artworks: [artworkSummary],
        exhibitions: [exhibitionSummary],
      },
    };
    expect(Value.Check(EditorialStoryDetailSchema, detail)).toBe(true);
    expect(
      Value.Check(EditorialStorySummarySchema, { ...storySummary, publishedAt: "not-a-date" }),
    ).toBe(false);
  });

  it("parses artist relations", () => {
    expect(
      Value.Check(EditorialArtistRelationsSchema, {
        exhibitions: [exhibitionSummary],
        stories: [storySummary],
      }),
    ).toBe(true);
  });

  it("still parses venue and placement payloads without the content fields", () => {
    const venue = { slug: "lax-marylebone", name: "LAX Marylebone", coverUrl: null };
    expect(Value.Check(EditorialVenueSummarySchema, venue)).toBe(true);
    expect(
      Value.Check(EditorialVenueDetailSchema, {
        ...venue,
        address: null,
        postcode: null,
        openingHours: null,
        phone: null,
        email: null,
        mapUrl: null,
        body: [],
      }),
    ).toBe(true);
    const placement = {
      slot: "home_hero",
      position: 0,
      headline: null,
      mediaUrl: null,
      linkUrl: null,
      refKind: "exhibition",
      refSlug: null,
    };
    expect(Value.Check(EditorialHomeResponseSchema, { placements: [placement] })).toBe(true);
  });

  it("parses story bylines, categories, series, podcasts and press", () => {
    const podcast = {
      ...storySummary,
      kind: "podcast",
      category: "podcast",
      authorName: "Ada Byrne",
      readMinutes: null,
      series: "In the studio",
      episodeNumber: 3,
      durationSeconds: 2460,
      publicationName: null,
      externalUrl: null,
    };
    expect(Value.Check(EditorialStorySummarySchema, podcast)).toBe(true);
    expect(
      Value.Check(EditorialStoryDetailSchema, {
        ...podcast,
        videoUrl: null,
        audioUrl: "https://cdn.example.com/episode-3.mp3",
        body: [],
      }),
    ).toBe(true);
    expect(
      Value.Check(EditorialStorySummarySchema, {
        ...storySummary,
        kind: "press",
        category: "press",
        publicationName: "The Art Newspaper",
        externalUrl: "https://example.com/review",
        readMinutes: 4,
      }),
    ).toBe(true);
    expect(Value.Check(EditorialStorySummarySchema, { ...storySummary, category: "essay" })).toBe(
      false,
    );
    expect(Value.Check(EditorialStorySummarySchema, { ...storySummary, readMinutes: 2.5 })).toBe(
      false,
    );
  });

  it("parses exhibition subtitle, contact and venue address lines", () => {
    const detail = {
      ...exhibitionDetail,
      subtitle: "Selling exhibition",
      venue: {
        slug: "lax-marylebone",
        name: "LAX Marylebone",
        streetLine: "12 Example Mews",
        postcode: "W1U 1AA",
        city: "London",
      },
      contact: {
        name: "Ada Byrne",
        role: "Gallery director",
        email: "ada@lax.art",
        phone: null,
        avatarUrl: null,
      },
    };
    expect(Value.Check(EditorialExhibitionDetailSchema, detail)).toBe(true);
    expect(Value.Check(EditorialExhibitionDetailSchema, { ...detail, contact: null })).toBe(true);
  });

  it("parses venue coordinates and placement copy for the new slots", () => {
    expect(
      Value.Check(EditorialVenueDetailSchema, {
        slug: "lax-marylebone",
        name: "LAX Marylebone",
        coverUrl: null,
        address: null,
        postcode: "W1U 1AA",
        streetLine: "12 Example Mews",
        city: "London",
        latitude: 51.5203,
        longitude: -0.1537,
        openingHours: null,
        phone: null,
        email: null,
        mapUrl: null,
        body: [],
      }),
    ).toBe(true);
    expect(
      Value.Check(EditorialHomeResponseSchema, {
        placements: [
          {
            slot: "art_hub_podcast",
            position: 0,
            headline: "The LAX Podcast",
            body: "Conversations with the artists we show.",
            ctaLabel: "Listen now",
            mediaUrl: null,
            linkUrl: "/stories",
            refKind: "external",
            refSlug: null,
          },
        ],
      }),
    ).toBe(true);
  });

  it("accepts story list filters by kind, category and series", () => {
    expect(
      Value.Check(EditorialStoryListQuerySchema, {
        kind: "podcast",
        category: "podcast",
        series: "In the studio",
      }),
    ).toBe(true);
    expect(Value.Check(EditorialStoryListQuerySchema, {})).toBe(true);
    expect(Value.Check(EditorialStoryListQuerySchema, { series: "" })).toBe(false);
  });
});
