import type { ArtEditorialPlacement } from "@/lib/editorial/art-editorial.types";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import { buildArtProductDoors } from "./art-product-doors.vm";

function link(id: LaxProductLinkVm["id"], href: string): LaxProductLinkVm {
  return { id, label: id, href, current: id === "art", external: id !== "art" };
}

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

describe("buildArtProductDoors", () => {
  const links = [link("bid", "https://bid.test"), link("shop", "https://shop.test")];

  it("puts LAX Shop before LAX Bid and links each to its storefront", () => {
    const doors = buildArtProductDoors([...links].reverse());

    expect(doors).toEqual([
      {
        product: "shop",
        title: "Limited editions from our artists",
        promise: expect.stringContaining("Editions and prints"),
        actionLabel: "Visit LAX Shop",
        href: "https://shop.test",
        imageUrl: null,
      },
      {
        product: "bid",
        title: "Art and collectibles at auction",
        promise: expect.stringContaining("Live and timed sales"),
        actionLabel: "Visit LAX Bid",
        href: "https://bid.test",
        imageUrl: null,
      },
    ]);
  });

  it("never describes Shop as a place for originals", () => {
    const [shop] = buildArtProductDoors(links);
    expect(`${shop?.title} ${shop?.promise}`.toLowerCase()).not.toContain("original");
  });

  it("leaves out a product the directory did not resolve and never shows lax.art itself", () => {
    const doors = buildArtProductDoors([
      link("art", "https://art.test"),
      link("shop", "https://shop.test"),
    ]);

    expect(doors.map((door) => door.product)).toEqual(["shop"]);
    expect(buildArtProductDoors([])).toEqual([]);
  });

  it("takes title, promise and image from a placement but keeps the link and action", () => {
    const [shop, bid] = buildArtProductDoors(links, [promo("home_promo_bid")]);

    expect(bid).toEqual({
      product: "bid",
      title: "CMS headline",
      promise: "CMS body",
      actionLabel: "Visit LAX Bid",
      href: "https://bid.test",
      imageUrl: "https://cdn.test/promo.jpg",
    });
    expect(shop).toMatchObject({ title: "Limited editions from our artists", imageUrl: null });
  });

  it("falls back per field when the placement leaves one blank", () => {
    const [, bid] = buildArtProductDoors(links, [
      promo("home_promo_bid", { headline: null, body: "  ", mediaUrl: null }),
    ]);

    expect(bid).toMatchObject({
      title: "Art and collectibles at auction",
      promise: expect.stringContaining("Live and timed sales"),
      imageUrl: null,
    });
  });

  it("uses the lowest-position placement when a slot holds several", () => {
    const [, bid] = buildArtProductDoors(links, [
      promo("home_promo_bid", { position: 2, headline: "Later" }),
      promo("home_promo_bid", { position: 1, headline: "First" }),
    ]);

    expect(bid?.title).toBe("First");
  });
});
