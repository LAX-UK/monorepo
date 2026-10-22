import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import "./contract-formats.js";
import {
  EditorialExhibitionUpdateBodySchema,
  EditorialExhibitionWriteBodySchema,
  EditorialStoryWriteBodySchema,
  EditorialVenueWriteBodySchema,
} from "./editorial-admin.js";

const exhibition = {
  slug: "summer-show",
  kind: "exhibition",
  title: "Summer show",
  summary: null,
  venueId: null,
  startsOn: "2026-06-01",
  endsOn: null,
  timesNote: null,
  coverMediaKey: null,
  featured: false,
  body: [],
};

describe("editorial entity update bodies", () => {
  it("require the version the editor opened", () => {
    expect(Value.Check(EditorialExhibitionUpdateBodySchema, exhibition)).toBe(false);
    expect(
      Value.Check(EditorialExhibitionUpdateBodySchema, {
        ...exhibition,
        expectedVersion: "2026-03-01T10:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("refuse a version that is not a timestamp", () => {
    expect(
      Value.Check(EditorialExhibitionUpdateBodySchema, { ...exhibition, expectedVersion: "soon" }),
    ).toBe(false);
  });

  it("leave create bodies without a version", () => {
    expect(Value.Check(EditorialExhibitionWriteBodySchema, exhibition)).toBe(true);
  });
});

describe("editorial write bodies checked in the browser", () => {
  it("rejects an impossible date and a malformed contact email", () => {
    expect(
      Value.Check(EditorialExhibitionWriteBodySchema, { ...exhibition, startsOn: "2026-02-30" }),
    ).toBe(false);
    expect(
      Value.Check(EditorialExhibitionWriteBodySchema, { ...exhibition, contactEmail: "imogen" }),
    ).toBe(false);
    expect(
      Value.Check(EditorialExhibitionWriteBodySchema, {
        ...exhibition,
        contactEmail: "imogen@example.com",
        subtitle: null,
      }),
    ).toBe(true);
  });

  it("accepts a story with podcast fields and refuses a non-https audio link", () => {
    const story = {
      slug: "ep-4",
      kind: "podcast",
      title: "Episode 4",
      standfirst: null,
      coverMediaKey: null,
      videoUrl: null,
      featured: false,
      body: [],
      series: "In the studio",
      episodeNumber: 4,
      durationSeconds: 2778,
    };
    expect(Value.Check(EditorialStoryWriteBodySchema, story)).toBe(true);
    expect(
      Value.Check(EditorialStoryWriteBodySchema, { ...story, audioUrl: "http://x.test/a.mp3" }),
    ).toBe(false);
  });

  it("bounds venue coordinates", () => {
    const venue = {
      slug: "mayfair",
      name: "Mayfair",
      address: null,
      postcode: null,
      phone: null,
      email: null,
      mapUrl: null,
      coverMediaKey: null,
      body: [],
      latitude: 51.5,
      longitude: -0.15,
    };
    expect(Value.Check(EditorialVenueWriteBodySchema, venue)).toBe(true);
    expect(Value.Check(EditorialVenueWriteBodySchema, { ...venue, latitude: 95 })).toBe(false);
  });
});
