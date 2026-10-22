import type { ArtEditorialPlacement } from "@/lib/editorial/art-editorial.types";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import { buildArtHomeEcosystemCards } from "./art-home-ecosystem.vm";
import { buildArtHomeGuidePromoVm } from "./art-home-promos.vm";

function link(id: LaxProductLinkVm["id"], href: string): LaxProductLinkVm {
  return { id, label: id, href, current: id === "art", external: id !== "art" };
}

describe("buildArtHomeEcosystemCards", () => {
  it("orders LAX Bid before LAX Shop and links each to its storefront", () => {
    const cards = buildArtHomeEcosystemCards([
      link("shop", "https://shop.test"),
      link("bid", "https://bid.test"),
    ]);

    expect(cards).toEqual([
      expect.objectContaining({
        id: "bid",
        eyebrow: "LAX Bid",
        title: "Bid in auctions",
        cta: { label: "Explore auctions", href: "https://bid.test" },
      }),
      expect.objectContaining({
        id: "shop",
        eyebrow: "LAX Shop",
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

describe("buildArtHomeEcosystemCards with promo placements", () => {
  const links = [link("bid", "https://bid.test"), link("shop", "https://shop.test")];
  const promo = (
    slot: ArtEditorialPlacement["slot"],
    overrides: Partial<ArtEditorialPlacement> = {},
  ): ArtEditorialPlacement => ({
    slot,
    position: 0,
    headline: "CMS headline",
    body: "CMS body",
    ctaLabel: "CMS cta",
    mediaUrl: "https://cdn.test/promo.jpg",
    linkUrl: "https://elsewhere.test/ignored",
    refKind: "external",
    refSlug: null,
    ...overrides,
  });

  it("uses the placement copy and image but keeps the directory link and product eyebrow", () => {
    const [bid, shop] = buildArtHomeEcosystemCards(links, [promo("home_promo_bid")]);

    expect(bid).toEqual({
      id: "bid",
      eyebrow: "LAX Bid",
      title: "CMS headline",
      body: "CMS body",
      cta: { label: "CMS cta", href: "https://bid.test" },
      imageUrl: "https://cdn.test/promo.jpg",
    });
    expect(shop).toMatchObject({ title: "Collect with certainty", imageUrl: null });
  });

  it("keeps the static copy and has no image when no placement exists", () => {
    const [bid] = buildArtHomeEcosystemCards(links, []);

    expect(bid).toMatchObject({
      title: "Bid in auctions",
      cta: { label: "Explore auctions", href: "https://bid.test" },
      imageUrl: null,
    });
  });

  it("falls back per field when the placement leaves one blank", () => {
    const [bid] = buildArtHomeEcosystemCards(links, [
      promo("home_promo_bid", { headline: null, body: "  ", ctaLabel: null, mediaUrl: null }),
    ]);

    expect(bid).toMatchObject({
      title: "Bid in auctions",
      body: expect.stringContaining("dedicated auction destination"),
      cta: { label: "Explore auctions" },
      imageUrl: null,
    });
  });

  it("uses the lowest-position placement when a slot holds several", () => {
    const [bid] = buildArtHomeEcosystemCards(links, [
      promo("home_promo_bid", { position: 2, headline: "Later" }),
      promo("home_promo_bid", { position: 1, headline: "First" }),
    ]);

    expect(bid?.title).toBe("First");
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
