import type { ArtistProfile } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  canArtistDelete,
  listArtistDeleteBlockers,
  listArtistDeleteWarnings,
  validateArtistDelete,
} from "./artist-delete.policy.js";

function artist(overrides: Partial<ArtistProfile> = {}): ArtistProfile {
  return {
    id: "a1",
    displayName: "Test Artist",
    slug: "test-artist",
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
    status: "pending",
    ownerUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const zeroGuards = { lotCount: 0, mergeDependentCount: 0, watchlistCount: 0 };

describe("listArtistDeleteBlockers", () => {
  it("returns empty when no blockers", () => {
    expect(listArtistDeleteBlockers({ artist: artist(), guards: zeroGuards })).toEqual([]);
  });

  it("blocks merged_into profiles", () => {
    const blockers = listArtistDeleteBlockers({
      artist: artist({ status: "merged_into", mergedIntoArtistId: "survivor" }),
      guards: zeroGuards,
    });
    expect(blockers).toContain("This profile was merged — open the survivor profile instead");
  });

  it("blocks when lots are attributed", () => {
    expect(
      listArtistDeleteBlockers({
        artist: artist(),
        guards: { ...zeroGuards, lotCount: 2 },
      }),
    ).toEqual(["This artist is attributed to 2 lots"]);
  });

  it("blocks when merge dependents exist", () => {
    expect(
      listArtistDeleteBlockers({
        artist: artist(),
        guards: { ...zeroGuards, mergeDependentCount: 1 },
      }),
    ).toEqual(["1 profile was merged into this artist"]);
  });

  it("accumulates multiple blockers", () => {
    const blockers = listArtistDeleteBlockers({
      artist: artist({ status: "merged_into" }),
      guards: { lotCount: 1, mergeDependentCount: 2, watchlistCount: 0 },
    });
    expect(blockers).toHaveLength(3);
  });
});

describe("listArtistDeleteWarnings", () => {
  it("warns about watchlist followers without blocking", () => {
    const warnings = listArtistDeleteWarnings({
      artist: artist(),
      guards: { ...zeroGuards, watchlistCount: 3 },
    });
    expect(warnings[0]).toMatch(/3 users follow/);
    expect(
      canArtistDelete({ artist: artist(), guards: { ...zeroGuards, watchlistCount: 3 } }),
    ).toBe(true);
  });

  it("warns when featured or verified", () => {
    const warnings = listArtistDeleteWarnings({
      artist: artist({ featured: true, verified: true }),
      guards: zeroGuards,
    });
    expect(warnings).toHaveLength(2);
  });
});

describe("validateArtistDelete", () => {
  it("returns ok when deletable", () => {
    expect(validateArtistDelete({ artist: artist(), guards: zeroGuards }).isOk()).toBe(true);
  });

  it("returns artist_delete_blocked with blockers array", () => {
    const result = validateArtistDelete({
      artist: artist({ status: "merged_into" }),
      guards: { lotCount: 1, mergeDependentCount: 0, watchlistCount: 0 },
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("artist_delete_blocked");
      expect(result.error.blockers?.length).toBeGreaterThan(0);
    }
  });
});
