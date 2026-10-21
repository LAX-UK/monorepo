import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import "./contract-formats.js";
import {
  EditorialArtistRelationsSchema,
  EditorialExhibitionDetailSchema,
  EditorialExhibitionSummarySchema,
  EditorialStoryDetailSchema,
  EditorialStorySummarySchema,
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
});
