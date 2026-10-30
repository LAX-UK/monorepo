import { verifyBearerToken } from "@auction/auth/token-verifier";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "collector-1",
    payload: { scope: "shop.read shop.write" },
  })),
}));

import { createShopApiApp } from "../../app.js";
import { createEnquiryRateLimiter } from "../../application/enquiry-rate-limit.js";
import type { EditorialSearchReader } from "../../application/ports/editorial-search.reader.js";
import type { EditorialRepository } from "../../application/ports/editorial.repository.js";
import { createInMemoryFixedWindowCounter } from "../../infrastructure/in-memory-fixed-window-counter.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";
import { createStubEditorialLinksService } from "../../test-support/stub-editorial-links-service.js";
import { createStubEditorialRepository } from "../../test-support/stub-editorial-repository.js";
import { createStubEditorialSearchReader } from "../../test-support/stub-editorial-search-reader.js";
import { createStubHelpRepository } from "../../test-support/stub-help-repository.js";

const userHeaders = { authorization: "Bearer user-token" };

const artworkSummary = {
  slug: "tidal-forms",
  title: "Tidal Forms",
  artistName: "Mara Ellison",
  artistSlug: "mara-ellison",
  imageUrl: null,
  saleState: "price_on_application" as const,
  dimensions: null,
  dimensionsCmDisplay: null,
  medium: null,
  yearCreated: null,
  objectType: null,
  rarity: null,
  salesChannel: "art" as const,
  eligibleForEditionAllocation: false,
  printPricePence: null,
  availability: { totalEditions: 0, state: "sold_out" as const },
  updatedAt: "2026-03-01T10:00:00.000Z",
  listedAt: "2026-03-01T10:00:00.000Z",
};

const artistDetail = {
  slug: "mara-ellison",
  name: "Mara Ellison",
  discipline: "Painter",
  portraitUrl: null,
  artworkCount: 1,
  bio: "Paints tides.",
  shortBio: null,
  heroUrl: null,
  nationality: "British",
  birthYear: 1980,
  deathYear: null,
  seoTitle: null,
  seoDescription: null,
};

const storySummary = {
  slug: "welcome",
  kind: "article" as const,
  category: "article" as const,
  title: "Welcome",
  standfirst: null,
  coverUrl: null,
  featured: false,
  publishedAt: "2026-03-01T09:00:00.000Z",
  authorName: null,
  readMinutes: null,
  series: null,
  episodeNumber: null,
  durationSeconds: null,
  publicationName: null,
  externalUrl: null,
};

const exhibitionSummary = {
  slug: "new-originals",
  kind: "exhibition" as const,
  title: "New Originals",
  summary: null,
  startsOn: "2026-03-01",
  endsOn: null,
  coverUrl: null,
  featured: true,
  subtitle: null,
  venue: { slug: "lax-marylebone", name: "LAX Marylebone" },
};

const bffHeaders = { authorization: "Bearer test-bff-token-minimum-32-characters-long" };
const ENQUIRY_ID = "6f1c1f0e-7f1a-4a43-9a51-0c1b1d2e3f40";

async function buildApp(
  overrides: Partial<EditorialRepository> = {},
  searchOverrides: Partial<EditorialSearchReader> = {},
) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...base.env, SHOP_EDITORIAL_ENABLED: true },
      editorial: {
        previewSecret: "test-preview-secret-minimum-32-chars",
        help: createStubHelpRepository(),
        enquiryRateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
        editorial: createStubEditorialRepository(overrides),
        links: createStubEditorialLinksService(),
        search: createStubEditorialSearchReader(searchOverrides),
      },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

describe("editorial routes", () => {
  afterEach(() => {
    vi.mocked(verifyBearerToken).mockClear();
  });

  it("returns home placements when editorial is enabled", async () => {
    const app = await buildApp({
      getHomePlacements: async () => [
        {
          slot: "home_hero",
          position: 0,
          headline: "Welcome",
          mediaUrl: null,
          linkUrl: null,
          refKind: "external",
          refSlug: null,
          body: null,
          ctaLabel: null,
        },
      ],
    });
    const res = await app.inject({ method: "GET", url: "/v1/editorial/home" });
    expect(res.statusCode).toBe(200);
    expect(res.json().placements).toHaveLength(1);
    await app.close();
  });

  it("lists published pages and story lastmod for the storefront sitemap", async () => {
    const app = await buildApp({
      listPages: async () => [{ slug: "faq", title: "FAQ", updatedAt: "2026-03-01T10:00:00.000Z" }],
      listStories: async () => [
        { ...storySummary, slug: "news", updatedAt: "2026-03-02T10:00:00.000Z" },
      ],
    });
    const pages = await app.inject({ method: "GET", url: "/v1/editorial/pages" });
    expect(pages.statusCode).toBe(200);
    expect(pages.json()).toEqual({
      items: [{ slug: "faq", title: "FAQ", updatedAt: "2026-03-01T10:00:00.000Z" }],
    });
    const stories = await app.inject({ method: "GET", url: "/v1/editorial/stories" });
    expect(stories.json().items[0].updatedAt).toBe("2026-03-02T10:00:00.000Z");
    await app.close();
  });

  it("searches exhibitions across every status when q is set", async () => {
    const listExhibitions = vi.fn(async () => []);
    const searchExhibitions = vi.fn(async () => [
      {
        slug: "summer-show",
        kind: "exhibition" as const,
        title: "Summer Show",
        summary: null,
        startsOn: "2025-06-01",
        endsOn: "2025-08-01",
        coverUrl: null,
        featured: false,
        subtitle: null,
        venue: null,
      },
    ]);
    const app = await buildApp({ listExhibitions }, { searchExhibitions });
    const res = await app.inject({
      method: "GET",
      url: "/v1/editorial/exhibitions?q=summer&status=current",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((item: { slug: string }) => item.slug)).toEqual(["summer-show"]);
    expect(searchExhibitions).toHaveBeenCalledWith("summer");
    expect(listExhibitions).not.toHaveBeenCalled();
    await app.close();
  });

  it("searches stories by q and keeps the kind filter", async () => {
    const searchStories = vi.fn(async () => []);
    const app = await buildApp({}, { searchStories });
    const res = await app.inject({ method: "GET", url: "/v1/editorial/stories?q=gold&kind=press" });
    expect(res.statusCode).toBe(200);
    expect(searchStories).toHaveBeenCalledWith("gold", "press");
    await app.close();
  });

  it("lists as before when q is blank and rejects an over-long q", async () => {
    const listStories = vi.fn(async () => []);
    const searchStories = vi.fn(async () => []);
    const app = await buildApp({ listStories }, { searchStories });
    await app.inject({ method: "GET", url: "/v1/editorial/stories?q=%20" });
    expect(listStories).toHaveBeenCalled();
    expect(searchStories).not.toHaveBeenCalled();
    const tooLong = await app.inject({
      method: "GET",
      url: `/v1/editorial/stories?q=${"a".repeat(121)}`,
    });
    expect(tooLong.statusCode).toBe(400);
    await app.close();
  });

  it("requires a bearer token to submit a general enquiry", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/me/general-enquiries",
      payload: { topic: "general", message: "Hello" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("requires shop.write to submit a general enquiry", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "collector-1",
      payload: { scope: "shop.read" },
    } as never);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/me/general-enquiries",
      headers: userHeaders,
      payload: { topic: "general", message: "Hello" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("stores a signed-in collector's enquiry with blank optional fields as null", async () => {
    const insertGeneralEnquiry = vi.fn(async () => ({
      enquiryId: ENQUIRY_ID,
      reference: "E-2041",
    }));
    const app = await buildApp({ insertGeneralEnquiry });
    const res = await app.inject({
      method: "POST",
      url: "/v1/me/general-enquiries",
      headers: userHeaders,
      payload: {
        topic: "private_viewing",
        message: "  Viewing please  ",
        contextSlug: " ",
        phone: "",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ enquiryId: ENQUIRY_ID, reference: "E-2041" });
    expect(insertGeneralEnquiry).toHaveBeenCalledWith({
      sender: {
        kind: "account",
        identitySubjectId: "collector-1",
        contactName: null,
        contactEmail: null,
      },
      topic: "private_viewing",
      contextSlug: null,
      message: "Viewing please",
      phone: null,
    });
    await app.close();
  });

  it("rejects a whitespace-only enquiry message", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/me/general-enquiries",
      headers: userHeaders,
      payload: { topic: "general", message: "   " },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns exhibition venue, works, artists and stories", async () => {
    const app = await buildApp({
      listExhibitions: async () => [exhibitionSummary],
      getExhibitionBySlug: async () => ({
        ...exhibitionSummary,
        timesNote: null,
        venueSlug: "lax-marylebone",
        contact: null,
        body: [],
        installationMedia: [],
        artworks: [artworkSummary],
        artists: [artistDetail],
        stories: [storySummary],
      }),
    });
    const list = await app.inject({ method: "GET", url: "/v1/editorial/exhibitions" });
    expect(list.json().items[0].venue).toEqual({ slug: "lax-marylebone", name: "LAX Marylebone" });
    const res = await app.inject({ method: "GET", url: "/v1/editorial/exhibitions/new-originals" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.artworks.map((a: { slug: string }) => a.slug)).toEqual(["tidal-forms"]);
    expect(body.artists[0]).toMatchObject({ slug: "mara-ellison", nationality: "British" });
    expect(body.stories[0]).toMatchObject({
      slug: "welcome",
      publishedAt: storySummary.publishedAt,
    });
    await app.close();
  });

  it("stores a guest enquiry sent through the BFF with the typed contact details", async () => {
    const insertGeneralEnquiry = vi.fn(async () => ({
      enquiryId: ENQUIRY_ID,
      reference: "E-2041",
    }));
    const app = await buildApp({ insertGeneralEnquiry });
    const res = await app.inject({
      method: "POST",
      url: "/v1/me/general-enquiries",
      headers: bffHeaders,
      payload: {
        topic: "general",
        message: "Do you ship to Edinburgh?",
        name: "Grace Hopper",
        email: "grace@example.com",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(insertGeneralEnquiry).toHaveBeenCalledWith({
      sender: { kind: "guest", contactName: "Grace Hopper", contactEmail: "grace@example.com" },
      topic: "general",
      contextSlug: null,
      message: "Do you ship to Edinburgh?",
      phone: null,
    });
    await app.close();
  });

  it("returns story publishedAt and related content", async () => {
    const app = await buildApp({
      getStoryBySlug: async () => ({
        ...storySummary,
        videoUrl: null,
        audioUrl: null,
        body: [],
        seoTitle: null,
        seoDescription: null,
        related: {
          artists: [artistDetail],
          artworks: [artworkSummary],
          exhibitions: [exhibitionSummary],
        },
      }),
    });
    const res = await app.inject({ method: "GET", url: "/v1/editorial/stories/welcome" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.publishedAt).toBe(storySummary.publishedAt);
    // Related artists are summaries: the public summary contract omits biography fields.
    expect(body.related.artists[0]).toEqual({
      slug: "mara-ellison",
      name: "Mara Ellison",
      discipline: "Painter",
      portraitUrl: null,
      artworkCount: 1,
    });
    expect(body.related.exhibitions[0].slug).toBe("new-originals");
    await app.close();
  });

  it("returns an artist's exhibitions and stories, or 404 for an unknown artist", async () => {
    const getArtistRelations = vi.fn(async (slug: string) =>
      slug === "mara-ellison"
        ? { exhibitions: [exhibitionSummary], stories: [storySummary] }
        : null,
    );
    const app = await buildApp({ getArtistRelations });
    const res = await app.inject({ method: "GET", url: "/v1/editorial/artists/mara-ellison" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ exhibitions: [exhibitionSummary], stories: [storySummary] });
    const missing = await app.inject({ method: "GET", url: "/v1/editorial/artists/nobody" });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it("rejects a guest general enquiry without an email", async () => {
    const insertGeneralEnquiry = vi.fn(async () => ({
      enquiryId: ENQUIRY_ID,
      reference: "E-2041",
    }));
    const app = await buildApp({ insertGeneralEnquiry });
    const res = await app.inject({
      method: "POST",
      url: "/v1/me/general-enquiries",
      headers: bffHeaders,
      payload: { topic: "general", message: "Hello", name: "Grace" },
    });
    expect(res.statusCode).toBe(400);
    expect(insertGeneralEnquiry).not.toHaveBeenCalled();
    await app.close();
  });

  it("answers a honeypot general enquiry with a 201 and stores nothing", async () => {
    const insertGeneralEnquiry = vi.fn(async () => ({
      enquiryId: ENQUIRY_ID,
      reference: "E-2041",
    }));
    const app = await buildApp({ insertGeneralEnquiry });
    const res = await app.inject({
      method: "POST",
      url: "/v1/me/general-enquiries",
      headers: bffHeaders,
      payload: {
        topic: "general",
        message: "Cheap watches",
        name: "Bot",
        email: "bot@example.com",
        website: "https://spam.example",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().enquiryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(insertGeneralEnquiry).not.toHaveBeenCalled();
    await app.close();
  });

  it("forwards story list filters and returns podcast and press fields", async () => {
    const listStories = vi.fn(async () => [
      {
        ...storySummary,
        slug: "episode-4",
        kind: "podcast" as const,
        category: "podcast" as const,
        series: "In the studio",
        episodeNumber: 4,
        durationSeconds: 2760,
        authorName: "Clara Hutchins",
        updatedAt: "2026-03-02T10:00:00.000Z",
      },
    ]);
    const app = await buildApp({ listStories });
    const res = await app.inject({
      method: "GET",
      url: "/v1/editorial/stories?category=podcast&series=In%20the%20studio",
    });
    expect(res.statusCode).toBe(200);
    expect(listStories).toHaveBeenCalledWith({ category: "podcast", series: "In the studio" });
    expect(res.json().items[0]).toMatchObject({
      kind: "podcast",
      category: "podcast",
      episodeNumber: 4,
      durationSeconds: 2760,
      authorName: "Clara Hutchins",
    });
    const invalid = await app.inject({ method: "GET", url: "/v1/editorial/stories?category=nope" });
    expect(invalid.statusCode).toBe(400);
    await app.close();
  });

  it("returns the exhibition subtitle and gallery contact", async () => {
    const contact = {
      name: "Elena Wendy",
      role: "Exhibition specialist",
      email: "elena@lax.art",
      phone: null,
      avatarUrl: null,
    };
    const app = await buildApp({
      getExhibitionBySlug: async () => ({
        ...exhibitionSummary,
        subtitle: "Selling exhibition",
        timesNote: null,
        venueSlug: null,
        contact,
        body: [],
        installationMedia: [],
        artworks: [],
        artists: [],
        stories: [],
      }),
    });
    const res = await app.inject({ method: "GET", url: "/v1/editorial/exhibitions/new-originals" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ subtitle: "Selling exhibition", contact });
    await app.close();
  });
});
