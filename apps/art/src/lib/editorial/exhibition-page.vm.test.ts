import { describe, expect, it } from "vitest";
import {
  buildExhibitionArtists,
  buildExhibitionFacts,
  buildExhibitionPress,
  buildExhibitionReveals,
} from "./exhibition-page.vm.js";

const venue = {
  name: "LAX Marylebone",
  href: "/visit/marylebone",
  addressLine: "587 Avenue, W1",
  mapUrl: " https://maps.test/lax ",
  phone: "020 7000 0000",
  email: "hello@lax.test",
};

describe("buildExhibitionFacts", () => {
  it("combines venue, dates with hours and venue contact", () => {
    expect(
      buildExhibitionFacts({
        dateLabel: "18 – 30 Sep 2026",
        timesNote: null,
        hours: [
          { label: "Mon – Sat", value: "10:00 – 17:00" },
          { label: "Sun", value: "12:00 – 17:00" },
        ],
        venue,
      }),
    ).toEqual({
      location: {
        name: "LAX Marylebone",
        href: "/visit/marylebone",
        addressLine: "587 Avenue, W1",
        mapUrl: "https://maps.test/lax",
      },
      viewing: ["18 – 30 Sep 2026", "Mon – Sat 10:00 – 17:00", "Sun 12:00 – 17:00"],
      contact: { phone: "020 7000 0000", email: "hello@lax.test" },
    });
  });

  it("prefers the times note and shows a lone hours string without its label", () => {
    expect(
      buildExhibitionFacts({
        dateLabel: null,
        timesNote: " By appointment ",
        hours: [{ label: "Opening hours", value: "10–6" }],
        venue: null,
      }).viewing,
    ).toEqual(["By appointment"]);
    expect(
      buildExhibitionFacts({
        dateLabel: null,
        timesNote: null,
        hours: [{ label: "Opening hours", value: "10–6" }],
        venue: null,
      }).viewing,
    ).toEqual(["10–6"]);
  });

  it("leaves location and contact null without a venue or contact details", () => {
    const facts = buildExhibitionFacts({
      dateLabel: "18 Sep 2026",
      timesNote: null,
      hours: [],
      venue: { ...venue, phone: " ", email: null, mapUrl: null },
    });
    expect(facts.contact).toBeNull();
    expect(facts.location?.mapUrl).toBeNull();
    expect(
      buildExhibitionFacts({ dateLabel: null, timesNote: null, hours: [], venue: null }),
    ).toEqual({ location: null, viewing: [], contact: null });
  });
});

describe("buildExhibitionArtists", () => {
  const artist = {
    slug: "elena",
    name: "Elena Marchetti",
    discipline: null,
    bio: null,
    portraitUrl: "/elena.jpg",
    artworkCount: 2,
  };

  it("links the artist and builds the life line", () => {
    expect(
      buildExhibitionArtists([
        { ...artist, bio: " Land art. ", nationality: "Italian", birthYear: 1978 },
      ]),
    ).toEqual([
      {
        slug: "elena",
        name: "Elena Marchetti",
        href: "/artists/elena",
        portraitUrl: "/elena.jpg",
        lifeLine: "Italian, b. 1978",
        bio: "Land art.",
      },
    ]);
  });

  it("falls back to the short bio and tolerates a bare record", () => {
    expect(buildExhibitionArtists([{ ...artist, shortBio: "Short." }])[0]).toMatchObject({
      bio: "Short.",
      lifeLine: null,
    });
    expect(buildExhibitionArtists([artist])[0]?.bio).toBeNull();
  });
});

describe("buildExhibitionPress", () => {
  const story = (slug: string, kind: "press" | "article", publishedAt?: string | null) => ({
    slug,
    kind,
    title: `Title ${slug}`,
    standfirst: null,
    coverUrl: null,
    featured: false,
    ...(publishedAt === undefined ? {} : { publishedAt }),
  });

  it("keeps press stories only, with a long date", () => {
    expect(
      buildExhibitionPress([
        story("a", "press", "2026-09-14T09:00:00.000Z"),
        story("b", "article", "2026-09-15T09:00:00.000Z"),
        story("c", "press", null),
        story("d", "press"),
      ]),
    ).toEqual([
      { key: "a", href: "/stories/a", title: "Title a", dateLabel: "14 September 2026" },
      { key: "c", href: "/stories/c", title: "Title c", dateLabel: null },
      { key: "d", href: "/stories/d", title: "Title d", dateLabel: null },
    ]);
  });
});

describe("buildExhibitionReveals", () => {
  const summary = {
    slug: "fragments",
    kind: "exhibition" as const,
    title: "Fragments of a Familiar World",
    summary: " A visual exploration. ",
    startsOn: "2026-04-16",
    endsOn: "2026-04-20",
    coverUrl: "/cover.jpg",
    featured: true,
  };

  it("builds eyebrow, dates and link for a featured show", () => {
    expect(
      buildExhibitionReveals([{ ...summary, venue: { slug: "marylebone", name: "London" } }]),
    ).toEqual([
      {
        key: "fragments",
        eyebrow: ["Featured exhibition", "London"],
        meta: ["16 Apr – 20 Apr 2026"],
        title: "Fragments of a Familiar World",
        summary: "A visual exploration.",
        href: "/exhibitions/fragments",
        imageUrl: "/cover.jpg",
      },
    ]);
  });

  it("drops the venue, dates and summary when unknown", () => {
    expect(
      buildExhibitionReveals([{ ...summary, summary: null, startsOn: null, endsOn: null }])[0],
    ).toMatchObject({ eyebrow: ["Featured exhibition"], meta: [], summary: null });
  });
});
