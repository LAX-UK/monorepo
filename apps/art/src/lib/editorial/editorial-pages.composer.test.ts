import type {
  ArtEditorialExhibitionDetail,
  ArtEditorialStoryDetail,
  ArtEditorialStorySummary,
  ArtEditorialVenueDetail,
} from "@/lib/editorial/art-editorial.types";
import { fakeArtServices } from "@/lib/testing/fake-art-services";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  composeCollectorHubPage,
  composeEditorialPage,
  composeExhibitionDetailPage,
  composeExhibitionsPage,
  composeGuideIndexPage,
  composeStoryPage,
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
    availability: { totalEditions: 0, state: "sold_out" },
  };
}

function storySummary(
  slug: string,
  kind: ArtEditorialStorySummary["kind"] = "article",
  publishedAt: string | null = "2026-10-01T00:00:00.000Z",
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

  it("drops the hero when it would only repeat the shows in the grid", async () => {
    const services = fakeArtServices();
    services.editorial.listExhibitions.mockImplementation(async (status) => ({
      status: "ok",
      data: { items: status === "current" ? [exhibition({ slug: "now", featured: true })] : [] },
    }));

    const current = await composeExhibitionsPage(services, "current");

    expect(current.status === "ok" && current.data.cards).toHaveLength(1);
    expect(current.status === "ok" && current.data.featured).toEqual([]);
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

  it("leads the byline with the subtitle and shows the named contact", async () => {
    const services = fakeArtServices();
    services.editorial.getExhibition.mockResolvedValue({
      status: "ok",
      data: exhibition({
        subtitle: "Selling exhibition",
        contact: {
          name: "Amelia Hart",
          role: "Exhibition specialist",
          email: "amelia@lax.test",
          phone: null,
          avatarUrl: null,
        },
      }),
    });
    services.editorial.getVenue.mockResolvedValue({
      status: "ok",
      data: venue({ phone: "020 7000 0000", email: "hello@lax.test" }),
    });

    const result = await composeExhibitionDetailPage(services, "summer-show");

    expect(result.status === "ok" && result.data).toMatchObject({
      metaLine: "Selling exhibition · 1 Jun – 30 Aug 2026",
      facts: { contact: { name: "Amelia Hart", email: "amelia@lax.test", phone: null } },
    });

    services.editorial.getExhibition.mockResolvedValue({
      status: "ok",
      data: exhibition({ subtitle: "  " }),
    });
    const blank = await composeExhibitionDetailPage(services, "summer-show");
    expect(blank.status === "ok" && blank.data.metaLine).toBe("Exhibition · 1 Jun – 30 Aug 2026");
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

  it("builds the title byline and marks the show closed the day after its end date", async () => {
    const services = fakeArtServices();
    services.editorial.getExhibition.mockResolvedValue({ status: "ok", data: exhibition() });
    services.editorial.getVenue.mockResolvedValue({ status: "not_found" });

    const lastDay = await composeExhibitionDetailPage(
      services,
      "summer-show",
      new Date("2026-08-30T22:00:00Z"),
    );
    expect(lastDay.status === "ok" && lastDay.data).toMatchObject({
      metaLine: "Exhibition · 1 Jun – 30 Aug 2026",
      ended: false,
    });

    // 23:00 UTC is already 31 August in London during BST.
    const after = await composeExhibitionDetailPage(
      services,
      "summer-show",
      new Date("2026-08-30T23:00:00Z"),
    );
    expect(after.status === "ok" && after.data.ended).toBe(true);
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
  const listed = {
    slug: "mayfair",
    name: "LAX Mayfair",
    coverUrl: null,
    streetLine: "1 Bond Street",
    postcode: "W1S 1AA",
    city: "London",
  };

  it("builds cards from the list alone, without per-venue reads", async () => {
    const services = fakeArtServices();
    services.editorial.listVenues.mockResolvedValue({ status: "ok", data: { items: [listed] } });
    const result = await composeVisitPage(services);
    expect(result).toEqual({
      status: "ok",
      data: {
        title: "Visit the gallery",
        intro: null,
        venues: [
          {
            slug: "mayfair",
            name: "LAX Mayfair",
            href: "/visit/mayfair",
            imageUrl: null,
            addressLines: ["1 Bond Street", "London W1S 1AA"],
          },
        ],
      },
    });
    expect(services.editorial.getVenue).not.toHaveBeenCalled();
  });

  it("takes the title and intro from a published visit page", async () => {
    const services = fakeArtServices();
    services.editorial.listVenues.mockResolvedValue({ status: "ok", data: { items: [] } });
    services.editorial.getPage.mockResolvedValue({
      status: "ok",
      data: {
        slug: "visit",
        title: "Visit LAX",
        body: [
          {
            type: "richText",
            spans: [{ text: "Two galleries in the heart of London, open to everyone." }],
          },
        ],
      },
    });
    const result = await composeVisitPage(services);
    expect(result.status === "ok" && result.data).toMatchObject({
      title: "Visit LAX",
      intro: "Two galleries in the heart of London, open to everyone.",
      venues: [],
    });
  });

  it("passes through a failed venue list", async () => {
    const services = fakeArtServices();
    services.editorial.listVenues.mockResolvedValue({ status: "error" });
    expect(await composeVisitPage(services)).toEqual({ status: "error" });
  });
});

describe("composeVenuePage", () => {
  const exhibitionAt = (slug: string, venueSlug: string | null) => ({
    slug,
    kind: "exhibition" as const,
    title: slug,
    summary: null,
    startsOn: null,
    endsOn: null,
    coverUrl: null,
    featured: false,
    venue: venueSlug ? { slug: venueSlug, name: venueSlug } : null,
  });

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

  it("lists current exhibitions at the venue from one list read", async () => {
    const services = fakeArtServices();
    services.editorial.getVenue.mockResolvedValue({ status: "ok", data: venue() });
    services.editorial.listExhibitions.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          exhibitionAt("here", "mayfair"),
          exhibitionAt("there", "soho"),
          exhibitionAt("x", null),
        ],
      },
    });
    const result = await composeVenuePage(services, "mayfair");
    expect(result.status === "ok" && result.data.exhibitions.map((c) => c.href)).toEqual([
      "/exhibitions/here",
    ]);
    expect(result.status === "ok" && result.data.sectionTabs.map((t) => t.id)).toEqual([
      "location",
      "exhibitions",
    ]);
    expect(services.editorial.listExhibitions).toHaveBeenCalledTimes(1);
    expect(services.editorial.listExhibitions).toHaveBeenCalledWith("current");
  });

  it("hides exhibitions and the jump-to bar when there is nothing to jump to", async () => {
    const services = fakeArtServices();
    services.editorial.getVenue.mockResolvedValue({ status: "ok", data: venue() });
    services.editorial.listExhibitions.mockResolvedValue({ status: "error" });
    const result = await composeVenuePage(services, "mayfair");
    expect(result.status === "ok" && result.data).toMatchObject({
      exhibitions: [],
      sectionTabs: [],
      hasLocation: true,
    });
  });

  it("hides the location section when the venue has no facts at all", async () => {
    const services = fakeArtServices();
    services.editorial.getVenue.mockResolvedValue({
      status: "ok",
      data: venue({ address: null, postcode: null, openingHours: null }),
    });
    const result = await composeVenuePage(services, "mayfair");
    expect(result.status === "ok" && result.data).toMatchObject({
      hasLocation: false,
      mapsHref: null,
    });
  });
});

describe("composeCollectorHubPage", () => {
  it("maps collector_hub_card placements to feature cards with body and CTA label", async () => {
    const services = fakeArtServices();
    services.editorial.home.mockResolvedValue({
      status: "ok",
      data: {
        placements: [
          {
            slot: "collector_hub_card",
            position: 1,
            headline: "Art advisory",
            body: "Guidance.",
            ctaLabel: null,
            mediaUrl: "/a.webp",
            linkUrl: null,
            refKind: "page",
            refSlug: "art-advisory",
          },
          {
            slot: "home_hero",
            position: 0,
            headline: "Other slot",
            mediaUrl: null,
            linkUrl: null,
            refKind: "page",
            refSlug: null,
          },
        ],
      },
    });
    const result = await composeCollectorHubPage(services);
    expect(result).toEqual({
      status: "ok",
      data: {
        cards: [
          {
            key: "collector_hub_card-1",
            href: "/collector-hub/art-advisory",
            title: "Art advisory",
            body: "Guidance.",
            ctaLabel: null,
            imageUrl: "/a.webp",
          },
        ],
      },
    });
  });
});

describe("composeGuideIndexPage", () => {
  const page = {
    status: "ok" as const,
    data: { slug: "101-guide", title: "Collecting 101", body: [] },
  };

  it("returns the page and guide cards with read time, asking only for guides", async () => {
    const services = fakeArtServices();
    services.editorial.getPage.mockResolvedValue(page);
    services.editorial.listStories.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            slug: "first",
            kind: "guide",
            title: "First guide",
            standfirst: "x",
            coverUrl: null,
            featured: false,
            readMinutes: 5,
          },
        ],
      },
    });
    const result = await composeGuideIndexPage(services, "101-guide");
    expect(result.status === "ok" && result.data.guides).toEqual([
      expect.objectContaining({
        href: "/stories/first",
        kicker: "LAX Guide",
        kickerDetail: "5 min read",
        meta: null,
      }),
    ]);
    expect(services.editorial.listStories).toHaveBeenCalledWith({ kind: "guide" });
  });

  it("shows no guides when the story list fails, and passes a missing page through", async () => {
    const services = fakeArtServices();
    services.editorial.getPage.mockResolvedValue(page);
    services.editorial.listStories.mockResolvedValue({ status: "error" });
    const result = await composeGuideIndexPage(services, "101-guide");
    expect(result.status === "ok" && result.data.guides).toEqual([]);

    services.editorial.getPage.mockResolvedValue({ status: "not_found" });
    expect(await composeGuideIndexPage(services, "101-guide")).toEqual({ status: "not_found" });
  });
});

function storyDetail(overrides: Partial<ArtEditorialStoryDetail> = {}): ArtEditorialStoryDetail {
  return {
    slug: "studio",
    kind: "article",
    title: "In the studio",
    standfirst: null,
    coverUrl: null,
    featured: false,
    videoUrl: null,
    body: [],
    publishedAt: "2026-10-21T10:00:00.000Z",
    category: "artist_interview",
    authorName: "Clara Hutchins",
    series: "In the studio",
    ...overrides,
  };
}

describe("composeStoryPage", () => {
  const now = new Date("2026-10-21T12:00:00Z");

  it("labels the hero with the category and byline", async () => {
    const services = fakeArtServices();
    services.editorial.getStory.mockResolvedValue({ status: "ok", data: storyDetail() });
    services.editorial.listStories.mockResolvedValue({ status: "ok", data: { items: [] } });
    const result = await composeStoryPage(services, "studio", now);
    expect(result).toMatchObject({
      status: "ok",
      data: {
        kicker: "Artist interview",
        byline: "By Clara Hutchins · 21 Oct 2026",
        related: null,
      },
    });
  });

  it("offers a current exhibition and does not read related stories", async () => {
    const services = fakeArtServices();
    services.editorial.getStory.mockResolvedValue({
      status: "ok",
      data: storyDetail({
        related: {
          artists: [],
          artworks: [],
          exhibitions: [
            {
              slug: "new-originals",
              kind: "exhibition",
              title: "New Originals",
              summary: null,
              startsOn: "2026-10-01",
              endsOn: "2026-12-01",
              coverUrl: null,
              featured: false,
            },
          ],
        },
      }),
    });
    const result = await composeStoryPage(services, "studio", now);
    expect(result).toMatchObject({
      status: "ok",
      data: { related: { kind: "exhibitions", heading: "Related exhibitions" } },
    });
    expect(services.editorial.listStories).not.toHaveBeenCalled();
  });

  it("falls back to same-series stories, then the same category, never the story itself", async () => {
    const services = fakeArtServices();
    services.editorial.getStory.mockResolvedValue({ status: "ok", data: storyDetail() });
    services.editorial.listStories.mockImplementation(async (filter) => ({
      status: "ok",
      data: { items: filter?.series ? [storySummary("studio")] : [storySummary("other")] },
    }));
    const result = await composeStoryPage(services, "studio", now);
    expect(services.editorial.listStories).toHaveBeenCalledWith({ series: "In the studio" });
    expect(services.editorial.listStories).toHaveBeenCalledWith({ category: "artist_interview" });
    expect(result).toMatchObject({
      status: "ok",
      data: { related: { kind: "stories", cards: [{ key: "other" }] } },
    });
  });

  it("passes a missing story through", async () => {
    const services = fakeArtServices();
    services.editorial.getStory.mockResolvedValue({ status: "not_found" });
    expect(await composeStoryPage(services, "nope", now)).toEqual({ status: "not_found" });
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
    expect(result.data.metaTitle).toBe("About us | lax.art");
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
        seoTitle: "About lax.art | London Gallery",
        seoDescription: "Our story.",
      },
    });
    const result = await composeEditorialPage(services, "about-us");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.data.metaTitle).toBe("About lax.art | London Gallery");
    expect(result.data.metaDescription).toBe("Our story.");
  });
});
