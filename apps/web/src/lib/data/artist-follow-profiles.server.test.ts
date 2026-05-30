import { resolveArtistFollowProfiles } from "@/lib/data/artist-follow-profiles.server";
import type { ArtistFollowRow } from "@/lib/data/dto/dashboard-dtos";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/http/artist.server", () => ({
  fetchRegistryArtistById: vi.fn(),
  portraitForPublicArtist: (url: string | null | undefined) => url?.trim() || null,
}));

import { fetchRegistryArtistById } from "@/lib/data/http/artist.server";

const mockFetch = vi.mocked(fetchRegistryArtistById);

describe("resolveArtistFollowProfiles", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const rows: ArtistFollowRow[] = [
    {
      watchlistId: "w1",
      artistId: "artist-1",
      createdAt: new Date("2024-06-01T12:00:00.000Z"),
    },
  ];

  it("maps registry profile fields into card VMs", async () => {
    mockFetch.mockResolvedValue({
      id: "artist-1",
      displayName: "Claude Monet",
      slug: "claude-monet",
      portraitUrl: "https://cdn.example/monet.jpg",
      heroImageUrl: null,
      shortBio: "Impressionist painter.",
      longBio: null,
      statement: null,
      nationality: "French",
      location: null,
      birthYear: "1840",
      deathYear: "1926",
      websiteUrl: null,
      socialLinks: {},
      featured: false,
      verified: true,
      archived: false,
      kind: "artist",
      ownerUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await resolveArtistFollowProfiles(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      watchlistId: "w1",
      artistId: "artist-1",
      displayName: "Claude Monet",
      portraitUrl: "https://cdn.example/monet.jpg",
      shortBio: "Impressionist painter.",
      nationality: "French",
      birthYear: "1840",
      deathYear: "1926",
      kind: "artist",
      followedAtMs: rows[0]?.createdAt.getTime() ?? 0,
    });
  });

  it("falls back to heroImageUrl when portraitUrl is missing", async () => {
    mockFetch.mockResolvedValue({
      id: "artist-1",
      displayName: "Claude Monet",
      slug: "claude-monet",
      portraitUrl: null,
      heroImageUrl: "https://cdn.example/monet-hero.jpg",
      shortBio: null,
      longBio: null,
      statement: null,
      nationality: null,
      location: null,
      birthYear: null,
      deathYear: null,
      websiteUrl: null,
      socialLinks: {},
      featured: false,
      verified: false,
      archived: false,
      ownerUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await resolveArtistFollowProfiles(rows);
    expect(result[0]?.portraitUrl).toBe("https://cdn.example/monet-hero.jpg");
  });

  it("falls back to slugified name when profile fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("network"));

    const result = await resolveArtistFollowProfiles(rows);
    expect(result[0]?.displayName).toBe("Artist 1");
    expect(result[0]?.portraitUrl).toBeNull();
  });
});
