import { describe, expect, it } from "vitest";
import { buildArtHomeGuidePromoVm } from "./art-home-promos.vm";

describe("buildArtHomeGuidePromoVm", () => {
  const card = (imageUrl: string | null) => ({
    key: `k-${imageUrl}`,
    href: null,
    headline: "Guide",
    kicker: null,
    meta: null,
    imageUrl,
  });

  it("links to the 101 guide and is text-only without a placement image", () => {
    expect(buildArtHomeGuidePromoVm([card(null)])).toEqual({
      title: "Finding your way into art.",
      body: expect.stringContaining("how to look at it"),
      cta: { label: "Explore the guide", href: "/collector-hub/101-guide" },
      imageUrl: null,
    });
  });

  it("uses the first placement that has an image", () => {
    expect(
      buildArtHomeGuidePromoVm([card(null), card("https://cdn.test/a.jpg"), card("b")]).imageUrl,
    ).toBe("https://cdn.test/a.jpg");
  });
});
