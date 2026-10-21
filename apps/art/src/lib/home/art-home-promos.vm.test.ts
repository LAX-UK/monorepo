import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import { buildArtHomeEcosystemCards } from "./art-home-ecosystem.vm";
import { buildArtHomeGuidePromoVm } from "./art-home-promos.vm";

function link(id: LaxProductLinkVm["id"], href: string): LaxProductLinkVm {
  return { id, label: id, href, current: id === "art", external: id !== "art" };
}

describe("buildArtHomeEcosystemCards", () => {
  it("orders LAX.bid before LAX.shop and links each to its storefront", () => {
    const cards = buildArtHomeEcosystemCards([
      link("shop", "https://shop.test"),
      link("bid", "https://bid.test"),
    ]);

    expect(cards).toEqual([
      expect.objectContaining({
        id: "bid",
        eyebrow: "LAX.BID",
        title: "Bid in auctions",
        cta: { label: "Explore auctions", href: "https://bid.test" },
      }),
      expect.objectContaining({
        id: "shop",
        eyebrow: "LAX.SHOP",
        title: "Collect with certainty",
        cta: { label: "Explore editions", href: "https://shop.test" },
      }),
    ]);
  });

  it("leaves out a product the directory did not resolve and ignores Art itself", () => {
    const cards = buildArtHomeEcosystemCards([
      link("art", "https://art.test"),
      link("shop", "https://shop.test"),
    ]);

    expect(cards.map((card) => card.id)).toEqual(["shop"]);
    expect(buildArtHomeEcosystemCards([])).toEqual([]);
  });
});

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
