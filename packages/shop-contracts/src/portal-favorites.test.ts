import { TypeCompiler } from "@sinclair/typebox/compiler";
import { describe, expect, it } from "vitest";
import {
  PortalFavoriteMutationResponseSchema,
  PortalFollowedArtistsResponseSchema,
  PortalSavedArtworkSchema,
  PortalSavedArtworksResponseSchema,
} from "./portal-favorites.js";

const savedArtwork = {
  artworkSlug: "demo",
  artworkTitle: "Demo",
  artistName: "Artist",
  artistSlug: "artist",
  imageUrl: null,
  salesChannel: "art",
  savedAt: "2026-01-01T00:00:00.000Z",
};

describe("PortalSavedArtworkSchema", () => {
  const check = TypeCompiler.Compile(PortalSavedArtworkSchema);

  it("accepts saved artwork rows", () => {
    expect(check.Check(savedArtwork)).toBe(true);
    expect(check.Check({ ...savedArtwork, imageUrl: "https://cdn.example/a.jpg" })).toBe(true);
  });

  it("rejects unknown sales channels and empty slugs", () => {
    expect(check.Check({ ...savedArtwork, salesChannel: "auction" })).toBe(false);
    expect(check.Check({ ...savedArtwork, artworkSlug: "" })).toBe(false);
  });
});

describe("PortalSavedArtworksResponseSchema", () => {
  it("wraps rows in items", () => {
    const check = TypeCompiler.Compile(PortalSavedArtworksResponseSchema);
    expect(check.Check({ items: [savedArtwork] })).toBe(true);
    expect(check.Check([savedArtwork])).toBe(false);
  });
});

describe("PortalFollowedArtistsResponseSchema", () => {
  it("accepts followed artist rows", () => {
    const check = TypeCompiler.Compile(PortalFollowedArtistsResponseSchema);
    expect(
      check.Check({
        items: [
          {
            artistSlug: "artist",
            artistName: "Artist",
            portraitUrl: null,
            followedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    ).toBe(true);
  });
});

describe("PortalFavoriteMutationResponseSchema", () => {
  const check = TypeCompiler.Compile(PortalFavoriteMutationResponseSchema);

  it.each(["saved", "already_saved", "followed", "already_followed", "removed", "already_removed"])(
    "accepts %s",
    (status) => {
      expect(check.Check({ status })).toBe(true);
    },
  );

  it("does not model unknown slugs as a status (those are 404 errors)", () => {
    expect(check.Check({ status: "not_found" })).toBe(false);
  });
});
