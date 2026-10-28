import { artworkSummary } from "@/test/artwork-summary.fixture";
import { describe, expect, it } from "vitest";
import { homeReleaseEyebrow, selectHomeRelease } from "./home-release";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const OLD = "2026-01-01T00:00:00.000Z";
const soldOut = artworkSummary({
  slug: "sold",
  availability: { totalEditions: 10, state: "sold_out" },
});
const noImage = artworkSummary({ slug: "no-image", imageUrl: null });

describe("selectHomeRelease", () => {
  it("takes the first featured edition that can be bought and has an image", () => {
    const live = artworkSummary({ slug: "live" });
    expect(selectHomeRelease([soldOut, noImage, live], [])).toEqual({ item: live, featured: true });
  });

  it("falls back to the newest edition on sale with an image", () => {
    const newest = artworkSummary({ slug: "newest" });
    expect(selectHomeRelease([soldOut], [noImage, soldOut, newest])).toEqual({
      item: newest,
      featured: false,
    });
  });

  it("never leads with a sold-out work or one without an image", () => {
    expect(selectHomeRelease([soldOut, noImage], [soldOut, noImage])).toBeNull();
  });
});

describe("homeReleaseEyebrow", () => {
  it("dates a new release, names a featured one, and says nothing otherwise", () => {
    expect(homeReleaseEyebrow({ item: artworkSummary(), featured: false }, NOW)).toBe(
      "New release · 1 Oct 2026",
    );
    expect(
      homeReleaseEyebrow({ item: artworkSummary({ listedAt: OLD }), featured: true }, NOW),
    ).toBe("Featured edition");
    expect(
      homeReleaseEyebrow({ item: artworkSummary({ listedAt: OLD }), featured: false }, NOW),
    ).toBeNull();
  });
});
