import type {
  ArtEditorialExhibitionDetail,
  ArtEditorialStorySummary,
  ArtEditorialVenueDetail,
} from "@/lib/editorial/art-editorial.types";
import { fakeArtServices } from "@/lib/testing/fake-art-services";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";
import {
  composeArtHubPage,
  composeEditorialPage,
  composeExhibitionDetailPage,
  composeExhibitionsPage,
  composeVenuePage,
  composeVisitPage,
  parseExhibitionStatus,
  presentOpeningHours,
} from "./editorial-pages.composer.js";

function exhibition(
  overrides: Partial<ArtEditorialExhibitionDetail> = {},
): ArtEditorialExhibitionDetail {
  return {
    slug: "summer-show",
    kind: "exhibition",
    title: "Summer show",
    summary: null,
    startsOn: "2026-06-01",
    endsOn: "2026-08-30",
    coverUrl: null,
    featured: false,
    timesNote: null,
    venueSlug: "mayfair",
    body: [],
    installationMedia: [],
    ...overrides,
  };
}

function artworkSummary(slug: string): PublicArtworkSummary {
  return {
    slug,
    title: `Work ${slug}`,
    artistName: "Elena Marchetti",
    artistSlug: "elena-marchetti",
    imageUrl: null,
    saleState: "price_on_application",
    dimensions: null,
    yearCreated: null,
    medium: null,
    salesChannel: "art",
    eligibleForEditionAllocation: false,
    printPricePence: null,
    availability: { totalEditions: 0, editionsAvailable: 0 },
  };
}

function storySummary(
  slug: string,
  kind: ArtEditorialStorySummary["kind"],
  publishedAt: string | null,
): ArtEditorialStorySummary {
  return {
    slug,
    kind,
    title: `Story ${slug}`,
    standfirst: null,
    coverUrl: null,
    featured: false,
    publishedAt,
  };
}

function venue(overrides: Partial<ArtEditorialVenueDetail> = {}): ArtEditorialVenueDetail {
  return {
    slug: "mayfair",
    name: "LAX Mayfair",
    address: "1 Bond Street",
    postcode: "W1",
    openingHours: { "Tue – Sat": "10:00 – 18:00" },
    phone: null,
    email: null,
    mapUrl: null,
    coverUrl: null,
    body: [],
    ...overrides,
  };
}

describe("presentOpeningHours", () => {
  it("accepts maps, row lists and plain strings, skipping junk", () => {
    expect(presentOpeningHours({ "Tue – Sat": "10–6", Sun: 3 })).toEqual([
      { label: "Tue – Sat", value: "10–6" },
    ]);
    expect(presentOpeningHours([{ label: "Mon", hours: "Closed" }, { label: "" }, null])).toEqual([
      { label: "Mon", value: "Closed" },
    ]);
    expect(presentOpeningHours(" By appointment ")).toEqual([
      { label: "Opening hours", value: "By appointment" },
    ]);
    expect(presentOpeningHours(null)).toEqual([]);
  });

  it("orders map-form hours by weekday because jsonb drops key order", () => {
    expect(
      presentOpeningHours({ Mon: "Closed", Sun: "12–5", "Tue – Sat": "10–6", Holidays: "Varies" }),
    ).toEqual([
      { label: "Mon", value: "Closed" },
      { label: "Tue – Sat", value: "10–6" },
      { label: "Sun", value: "12–5" },
      { label: "Holidays", value: "Varies" },
    ]);
  });
});

describe("parseExhibitionStatus", () => {
  it("defaults unknown values to current", () => {
    expect(parseExhibitionStatus("past")).toBe("past");
    expect(parseExhibitionStatus(["upcoming"])).toBe("upcoming");
    expect(parseExhibitionStatus("drop table")).toBe("current");
  });
});

describe("composeExhibitionsPage", () => {
  it("features current then upcoming shows on every tab, without duplicates", async () => {
    const services = fakeArtServices();
    services.editorial.listExhibitions.mockImplementation(async (status) => ({
      status: "ok",
      data: {
        items:
          status === "current"
            ? [exhibition({ slug: "now", featured: true }), exhibition({ slug: "plain" })]
            : status === "upcoming"
              ? [exhibition({ slug: "soon", featured: true })]
              : [exhibition({ slug: "old", featured: true })],
      },
    }));

    const past = await composeExhibitionsPage(services, "past");

    expect(past.status === "ok" && past.data.cards.map((c) => c.href)).toEqual([
      "/exhibitions/old",
    ]);
    expect(past.status === "ok" && past.data.featured.map((c) => c.href)).toEqual([
      "/exhibitions/now",
      "/exhibitions/soon",
    ]);
    expect(services.editorial.listExhibitions).toHaveBeenCalledTimes(3);
  });

  it("keeps the grid when featured reads fail and passes through grid failures", async () => {
    const services = fakeArtServices();
    services.editorial.listExhibitions.mockImplementation(async (status) =>
      status === "current"
        ? { status: "ok", data: { items: [exhibition({ slug: "now" })] } }
        : { status: "error" },
    );
    const current = await composeExhibitionsPage(services, "current");
    expect(current.status === "ok" && current.data.featured).toEqual([]);
    expect(current.status === "ok" && current.data.cards).toHaveLength(1);

    const upcoming = await composeExhibitionsPage(services, "upcoming");
    expect(upcoming.status).toBe("error");
  });
});

describe("composeExhibitionDetailPage", () => {
  it("builds facts from the venue, preferring the exhibition times note for viewing", async () => {
    const services = fakeArtServices();
    services.editorial.getExhibition.mockResolvedValue({ status: "ok", data: exhibition() });
    services.editorial.getVenue.mockResolvedValue({
      status: "ok",
      data: venue({
        phone: "020 7000 0000",
        email: "hello@lax.test",
        mapUrl: "https://maps.test/x",
      }),
    });

    const result = await composeExhibitionDetailPage(services, "summer-show");
    expect(result).toMatchObject({
      status: "ok",
      data: {
        dateLabel: "1 Jun – 30 Aug 2026",
        facts: {
          location: {
            name: "LAX Mayfair",
            href: "/visit/mayfair",
            addressLine: "1 Bond Street, W1",
            mapUrl: "https://maps.test/x",
          },
          viewing: ["1 Jun – 30 Aug 2026", "Tue – Sat 10:00 – 18:00"],
          contact: { phone: "020 7000 0000", email: "hello@lax.test" },
        },
      },
    });

    services.editorial.getExhibition.mockResolvedValue({
      status: "ok",
      data: exhibition({ timesNote: "Late opening Thursdays" }),
    });
    const withNote = await composeExhibitionDetailPage(services, "summer-show");
    expect(withNote.status === "ok" && withNote.data.facts.viewing).toEqual([
      "1 Jun – 30 Aug 2026",
      "Late opening Thursdays",
    ]);
  });

  it("falls back to the exhibition's venue summary when the venue read fails", async () => {
    const services = fakeArtServices();
    services.editorial.getExhibition.mockResolvedValue({
      status: "ok",
      data: exhibition({ venue: { slug: "mayfair", name: "LAX Mayfair" } }),
    });
    services.editorial.getVenue.mockResolvedValue({ status: "error" });

    const result = await composeExhibitionDetailPage(services, "summer-show");
    expect(result.status === "ok" && result.data.facts).toMatchObject({
      location: { name: "LAX Mayfair", href: "/visit/mayfair", addressLine: null, mapUrl: null },
      contact: null,
    });
  });

  it("maps artworks, artists and press stories, ignoring other story kinds", async () => {
    const services = fakeArtServices();
    services.editorial.getExhibition.mockResolvedValue({
      status: "ok",
      data: exhibition({
        artworks: [artworkSummary("blue-field")],
        artists: [
          {
            slug: "elena-marchetti",
            name: "Elena Marchetti",
            discipline: null,
            bio: "Works with land art.",
            portraitUrl: null,
            nationality: "Italian",
            birthYear: 1978,
            deathYear: null,
            artworkCount: 3,
          },
        ],
        stories: [
          storySummary("review", "press", "2026-09-14T10:00:00.000Z"),
          storySummary("film", "film", null),
        ],
      }),
    });
    services.editorial.getVenue.mockResolvedValue({ status: "not_found" });

    const result = await composeExhibitionDetailPage(services, "summer-show");
    expect(result.status === "ok" && result.data).toMatchObject({
      works: [{ slug: "blue-field", href: "/artworks/blue-field" }],
      artists: [
        { name: "Elena Marchetti", lifeLine: "Italian, b. 1978", bio: "Works with land art." },
      ],
      press: [{ href: "/stories/review", title: "Story review", dateLabel: "14 September 2026" }],
      favoriteAuth: { signedIn: false },
    });
  });

  it("returns empty sections when the relations are missing", async () => {
    const services = fakeArtServices();
    services.editorial.getExhibition.mockResolvedValue({ status: "ok", data: exhibition() });
    services.editorial.getVenue.mockResolvedValue({ status: "not_found" });

    const result = await composeExhibitionDetailPage(services, "summer-show");
    expect(result.status === "ok" && result.data).toMatchObject({
      works: [],
      artists: [],
      press: [],
      facts: { location: null, viewing: ["1 Jun – 30 Aug 2026"], contact: null },
    });
  });

  it("builds the title byline and marks the show closed after its end date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const services = fakeArtServices();
      services.editorial.getExhibition.mockResolvedValue({ status: "ok", data: exhibition() });
      services.editorial.getVenue.mockResolvedValue({ status: "not_found" });

      vi.setSystemTime(new Date("2026-08-30T22:00:00Z"));
      const lastDay = await composeExhibitionDetailPage(services, "summer-show");
      expect(lastDay.status === "ok" && lastDay.data).toMatchObject({
        metaLine: "Exhibition · 1 Jun – 30 Aug 2026",
        ended: false,
      });

      vi.setSystemTime(new Date("2026-08-31T00:00:00Z"));
      const after = await composeExhibitionDetailPage(services, "summer-show");
      expect(after.status === "ok" && after.data.ended).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes through not found and tolerates a missing venue", async () => {
    const services = fakeArtServices();
    services.editorial.getExhibition.mockResolvedValue({ status: "not_found" });
    expect(await composeExhibitionDetailPage(services, "x")).toEqual({ status: "not_found" });

    services.editorial.getExhibition.mockResolvedValue({ status: "ok", data: exhibition() });
    services.editorial.getVenue.mockResolvedValue({ status: "not_found" });
    const result = await composeExhibitionDetailPage(services, "summer-show");
    expect(result.status === "ok" && result.data.facts.location).toBeNull();
  });
});

describe("composeVisitPage", () => {
  it("loads every venue detail and reports error only when all details fail", async () => {
    const services = fakeArtServices();
    services.editorial.listVenues.mockResolvedValue({
      status: "ok",
      data: { items: [{ slug: "mayfair", name: "LAX Mayfair", coverUrl: null }] },
    });
    services.editorial.getVenue.mockResolvedValue({ status: "ok", data: venue() });
    const ok = await composeVisitPage(services);
    expect(ok.status === "ok" && ok.data.venues[0]).toMatchObject({
      href: "/visit/mayfair",
      addressLine: "1 Bond Street, W1",
      hours: [{ label: "Tue – Sat", value: "10:00 – 18:00" }],
    });

    services.editorial.getVenue.mockResolvedValue({ status: "error" });
    expect(await composeVisitPage(services)).toEqual({ status: "error" });
  });
});

describe("composeVenuePage", () => {
  it("returns the venue facts and body, and passes through not found", async () => {
    const services = fakeArtServices();
    services.editorial.getVenue.mockResolvedValue({
      status: "ok",
      data: venue({ address: null, postcode: null }),
    });
    const ok = await composeVenuePage(services, "mayfair");
    expect(ok.status === "ok" && ok.data).toMatchObject({
      addressLine: null,
      hours: [{ label: "Tue – Sat", value: "10:00 – 18:00" }],
      venue: { slug: "mayfair" },
    });

    services.editorial.getVenue.mockResolvedValue({ status: "not_found" });
    expect(await composeVenuePage(services, "nowhere")).toEqual({ status: "not_found" });
  });
});

describe("composeArtHubPage", () => {
  it("renders stories even when placements fail", async () => {
    const services = fakeArtServices();
    services.editorial.home.mockResolvedValue({ status: "error" });
    services.editorial.listStories.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            slug: "studio",
            kind: "guide",
            title: "Studio guide",
            standfirst: null,
            coverUrl: null,
            featured: false,
          },
        ],
      },
    });
    const result = await composeArtHubPage(services);
    expect(result).toMatchObject({
      status: "ok",
      data: { spotlight: [], stories: [{ href: "/stories/studio", kicker: "Guide" }] },
    });
  });
});

describe("composeEditorialPage metadata", () => {
  const paragraph = "We help collectors find original work from emerging and established artists.";

  it("derives the description from the first substantial paragraph", async () => {
    const services = fakeArtServices();
    services.editorial.getPage.mockResolvedValue({
      status: "ok",
      data: {
        slug: "about-us",
        title: "About us",
        body: [
          { type: "richText", spans: [{ text: "Short." }] },
          { type: "richText", spans: [{ text: paragraph }] },
        ],
      },
    });
    const result = await composeEditorialPage(services, "about-us");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.data.metaTitle).toBe("About us | LAX Art");
    expect(result.data.metaDescription).toBe(paragraph);
  });

  it("prefers imported SEO overrides", async () => {
    const services = fakeArtServices();
    services.editorial.getPage.mockResolvedValue({
      status: "ok",
      data: {
        slug: "about-us",
        title: "About us",
        body: [],
        seoTitle: "About The LAX Art | London Gallery",
        seoDescription: "Our story.",
      },
    });
    const result = await composeEditorialPage(services, "about-us");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.data.metaTitle).toBe("About The LAX Art | London Gallery");
    expect(result.data.metaDescription).toBe("Our story.");
  });
});
