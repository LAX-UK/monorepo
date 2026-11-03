import { artworkSummary } from "@/test/artwork-summary.fixture";
import { describe, expect, it } from "vitest";
import {
  type HomePhotographs,
  homePhotographAddresses,
  homeReleaseEyebrow,
  selectHomeRelease,
} from "./home-release";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const OLD = "2026-01-01T00:00:00.000Z";
const soldOut = artworkSummary({
  slug: "sold",
  availability: { totalEditions: 10, state: "sold_out" },
});
const noImage = artworkSummary({ slug: "no-image", imageUrl: null });

const read = { width: 800, height: 1000, mean: [120, 90, 80] as const };
const photos = (...readable: string[]): HomePhotographs => ({
  imageSrc: (item) => item.imageUrl,
  imageFacts: new Map(readable.map((src) => [src, read])),
});

describe("selectHomeRelease", () => {
  const live = artworkSummary({ slug: "live", imageUrl: "/live.webp" });

  it("reads stock and the image from each listing for the shop-domain rule", () => {
    expect(selectHomeRelease([soldOut, noImage, live], [], photos("/live.webp"))).toEqual({
      item: live,
      featured: true,
    });
    expect(selectHomeRelease([soldOut, noImage], [], photos("/live.webp"))).toBeNull();
  });

  it("skips an edition whose image is listed but cannot be read, for the next lead", () => {
    const broken = artworkSummary({ slug: "broken", imageUrl: "/broken.webp" });
    expect(selectHomeRelease([broken, live], [], photos("/live.webp"))?.item).toBe(live);
    expect(selectHomeRelease([broken], [live], photos("/live.webp"))).toEqual({
      item: live,
      featured: false,
    });
  });

  it("has no release when no edition has an image that can be shown", () => {
    const broken = artworkSummary({ slug: "broken", imageUrl: "/broken.webp" });
    expect(selectHomeRelease([broken], [broken], photos())).toBeNull();
  });
});

describe("homePhotographAddresses", () => {
  it("lists every edition the release may be chosen from, so the choice can skip a broken one", () => {
    const a = artworkSummary({ slug: "a", imageUrl: "/a.webp" });
    const b = artworkSummary({ slug: "b", imageUrl: "/b.webp" });
    const none = artworkSummary({ slug: "none", imageUrl: null });
    expect(
      homePhotographAddresses({ featured: [a, none], editions: [b] }, (i) => i.imageUrl),
    ).toEqual(["/a.webp", "/b.webp"]);
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
