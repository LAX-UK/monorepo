import { loadRelatedDirectoryArtists } from "@/lib/artists/related-directory-artists.server";
import type { PublicArtistDirectoryRow } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/http/artist.server", () => ({
  fetchPublicArtistBrowse: vi.fn(),
}));

import { fetchPublicArtistBrowse } from "@/lib/data/http/artist.server";

const mockBrowse = vi.mocked(fetchPublicArtistBrowse);

function row(id: string, displayName: string): PublicArtistDirectoryRow {
  return {
    id,
    displayName,
    slug: displayName.toLowerCase().replace(/\s+/g, "-"),
    portraitUrl: null,
    heroImageUrl: null,
    shortBio: null,
    longBio: null,
    statement: null,
    nationality: null,
    location: null,
    countryCode: null,
    birthYear: null,
    deathYear: null,
    foundedYear: null,
    dissolvedYear: null,
    websiteUrl: null,
    socialLinks: {},
    attributes: {},
    featured: false,
    verified: false,
    archived: false,
    ownerUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lotCount: 1,
  };
}

describe("loadRelatedDirectoryArtists", () => {
  beforeEach(() => {
    mockBrowse.mockReset();
  });

  it("excludes the current artist and caps at eight", async () => {
    mockBrowse.mockResolvedValueOnce({
      rows: [
        row("current", "Current Artist"),
        row("a1", "Artist One"),
        row("a2", "Artist Two"),
        row("a3", "Artist Three"),
        row("a4", "Artist Four"),
      ],
      total: 5,
      facets: {
        total: 5,
        featured: 0,
        living: 0,
        historical: 0,
        byKind: { artist: 5, maker: 0, brand: 0, marque: 0 },
        hasUpcoming: 0,
        topNationalities: [],
        topCategories: [],
        topDecades: [],
        letters: [],
      },
    });

    const result = await loadRelatedDirectoryArtists("current", {
      id: "current",
      displayName: "Current Artist",
      slug: "current-artist",
      portraitUrl: null,
      heroImageUrl: null,
      shortBio: null,
      longBio: null,
      statement: null,
      nationality: null,
      location: null,
      countryCode: null,
      birthYear: null,
      deathYear: null,
      foundedYear: null,
      dissolvedYear: null,
      websiteUrl: null,
      socialLinks: {},
      attributes: {},
      featured: false,
      verified: false,
      archived: false,
      kind: "artist",
      ownerUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(result.map((r) => r.id)).toEqual(["a1", "a2", "a3", "a4"]);
    expect(mockBrowse).toHaveBeenCalledTimes(1);
  });

  it("falls back to a broader browse when the kind slice is sparse", async () => {
    mockBrowse
      .mockResolvedValueOnce({
        rows: [row("current", "Current Artist"), row("a1", "Artist One")],
        total: 2,
        facets: {
          total: 2,
          featured: 0,
          living: 0,
          historical: 0,
          byKind: { artist: 2, maker: 0, brand: 0, marque: 0 },
          hasUpcoming: 0,
          topNationalities: [],
          topCategories: [],
          topDecades: [],
          letters: [],
        },
      })
      .mockResolvedValueOnce({
        rows: [
          row("current", "Current Artist"),
          row("a1", "Artist One"),
          row("a2", "Artist Two"),
          row("a3", "Artist Three"),
          row("a4", "Artist Four"),
        ],
        total: 5,
        facets: {
          total: 5,
          featured: 0,
          living: 0,
          historical: 0,
          byKind: { artist: 5, maker: 0, brand: 0, marque: 0 },
          hasUpcoming: 0,
          topNationalities: [],
          topCategories: [],
          topDecades: [],
          letters: [],
        },
      });

    const result = await loadRelatedDirectoryArtists("current", null);
    expect(result.map((r) => r.id)).toEqual(["a1", "a2", "a3", "a4"]);
    expect(mockBrowse).toHaveBeenCalledTimes(2);
  });
});
