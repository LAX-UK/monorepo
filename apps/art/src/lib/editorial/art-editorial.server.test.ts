import { beforeEach, describe, expect, it, vi } from "vitest";

const { artCatalogueFetch, isArtEditorialEnabled } = vi.hoisted(() => ({
  artCatalogueFetch: vi.fn(),
  isArtEditorialEnabled: vi.fn(),
}));

vi.mock("@/lib/art-catalogue.server", () => ({
  ART_SLUG_LOOKUP: { cache: "no-store" },
  artCatalogueApiBaseUrl: () => "http://shop-api.test",
  artCatalogueFetch,
}));
vi.mock("@/lib/art-runtime-flags", () => ({ isArtEditorialEnabled }));

import {
  fetchEditorialArtistRelations,
  fetchEditorialExhibitionBySlug,
  fetchEditorialStories,
  fetchEditorialStoryBySlug,
} from "@/lib/editorial/art-editorial.server";

const exhibitionSummary = {
  slug: "new-originals",
  kind: "exhibition",
  title: "New Originals",
  summary: null,
  startsOn: "2026-10-01",
  endsOn: null,
  coverUrl: null,
  featured: true,
  venue: { slug: "lax-marylebone", name: "LAX Marylebone" },
};

const storySummary = {
  slug: "welcome",
  kind: "article",
  title: "Welcome",
  standfirst: null,
  coverUrl: null,
  featured: false,
  publishedAt: "2026-10-01T09:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("art editorial BFF", () => {
  beforeEach(() => {
    artCatalogueFetch.mockReset();
    isArtEditorialEnabled.mockReturnValue(true);
  });

  it("reads an artist's exhibitions and stories fresh", async () => {
    const relations = { exhibitions: [exhibitionSummary], stories: [storySummary] };
    artCatalogueFetch.mockResolvedValue(jsonResponse(relations));

    await expect(fetchEditorialArtistRelations("mara ellison")).resolves.toEqual({
      status: "ok",
      data: relations,
    });
    expect(artCatalogueFetch).toHaveBeenCalledWith("/v1/editorial/artists/mara%20ellison", {
      cache: "no-store",
    });
  });

  it("passes story list filters as query parameters and keeps new story fields", async () => {
    const podcast = {
      ...storySummary,
      slug: "studio-light",
      kind: "podcast",
      category: "podcast",
      series: "In the studio",
      episodeNumber: 4,
      durationSeconds: 2778,
    };
    artCatalogueFetch.mockResolvedValue(jsonResponse({ items: [podcast] }));

    const result = await fetchEditorialStories({ category: "podcast", series: "In the studio" });
    expect(result).toEqual({ status: "ok", data: { items: [podcast] } });
    expect(artCatalogueFetch.mock.calls[0]?.[0]).toBe(
      "/v1/editorial/stories?category=podcast&series=In+the+studio",
    );

    artCatalogueFetch.mockClear();
    artCatalogueFetch.mockResolvedValue(jsonResponse({ items: [] }));
    await fetchEditorialStories();
    expect(artCatalogueFetch.mock.calls[0]?.[0]).toBe("/v1/editorial/stories");
  });

  it("reports an unknown artist as not_found and skips the read when editorial is off", async () => {
    artCatalogueFetch.mockResolvedValue(jsonResponse({}, 404));
    await expect(fetchEditorialArtistRelations("nobody")).resolves.toEqual({
      status: "not_found",
    });

    isArtEditorialEnabled.mockReturnValue(false);
    artCatalogueFetch.mockClear();
    await expect(fetchEditorialArtistRelations("nobody")).resolves.toEqual({
      status: "disabled",
    });
    expect(artCatalogueFetch).not.toHaveBeenCalled();
  });

  it("keeps exhibition works, artists and stories on the detail", async () => {
    const detail = {
      ...exhibitionSummary,
      timesNote: null,
      venueSlug: "lax-marylebone",
      body: [],
      installationMedia: [],
      artworks: [],
      artists: [
        {
          slug: "mara-ellison",
          name: "Mara Ellison",
          discipline: null,
          portraitUrl: null,
          artworkCount: 0,
          bio: null,
          nationality: "British",
          birthYear: 1980,
          deathYear: null,
        },
      ],
      stories: [storySummary],
    };
    artCatalogueFetch.mockResolvedValue(jsonResponse(detail));

    const result = await fetchEditorialExhibitionBySlug("new-originals");
    expect(result.status === "ok" && result.data.artists?.[0]?.nationality).toBe("British");
    expect(result.status === "ok" && result.data.venue?.name).toBe("LAX Marylebone");
  });

  it("keeps story publishedAt and related content on the detail", async () => {
    artCatalogueFetch.mockResolvedValue(
      jsonResponse({
        ...storySummary,
        videoUrl: null,
        body: [],
        related: { artists: [], artworks: [], exhibitions: [exhibitionSummary] },
      }),
    );

    const result = await fetchEditorialStoryBySlug("welcome");
    expect(result.status === "ok" && result.data.publishedAt).toBe(storySummary.publishedAt);
    expect(result.status === "ok" && result.data.related?.exhibitions[0]?.slug).toBe(
      "new-originals",
    );
  });
});
