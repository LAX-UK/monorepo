import type { PublicArtworkDetail, PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { addToBasketErrorMessage } from "./add-to-basket-error";
import {
  buildArtworkProductPage,
  buildGalleryImages,
  selectRelatedEditions,
} from "./artwork-product-page.vm";

function summary(overrides: Partial<PublicArtworkSummary> = {}): PublicArtworkSummary {
  return {
    slug: "warm-basket",
    title: "Warm Basket",
    artistName: "Emmett King",
    artistSlug: "emmett-king",
    imageUrl: "/warm-basket.webp",
    saleState: "for_sale",
    dimensions: null,
    medium: "Giclée print",
    yearCreated: 2025,
    salesChannel: "shop",
    eligibleForEditionAllocation: true,
    printPricePence: 12_000,
    availability: { totalEditions: 24, state: "available" },
    ...overrides,
  };
}

function detail(overrides: Partial<PublicArtworkDetail> = {}): PublicArtworkDetail {
  return {
    ...summary(),
    description: "  A still life.  ",
    images: [],
    heightCm: 50,
    widthCm: 40,
    depthCm: null,
    hasCertificate: true,
    ...overrides,
  };
}

const ART = new URL("https://www.thelax.art/");

describe("product page view model", () => {
  it("offers every image the API returns, in order, with the primary as a fallback", () => {
    expect(
      buildGalleryImages(
        detail({
          images: [
            { url: "/a.webp", alt: "Front", caption: null, blurDataUrl: null },
            { url: "/b.webp", alt: null, caption: null, blurDataUrl: null },
            { url: "/a.webp", alt: "Duplicate", caption: null, blurDataUrl: null },
          ],
        }),
      ),
    ).toEqual([
      { url: "/a.webp", alt: "Front" },
      { url: "/b.webp", alt: "Warm Basket by Emmett King" },
    ]);
    expect(buildGalleryImages(detail())).toEqual([
      { url: "/warm-basket.webp", alt: "Warm Basket by Emmett King" },
    ]);
    expect(buildGalleryImages(detail({ imageUrl: null }))).toEqual([]);
  });

  it("links the artist and the original to lax.art only when they can be linked", () => {
    const linked = buildArtworkProductPage({
      artwork: detail({ sourceOriginalSlug: "warm-basket-original" }),
      artistEditions: [],
      artBaseUrl: ART,
    });
    expect(linked.crossLinks).toEqual({
      artistOnArtHref: "https://www.thelax.art/artists/emmett-king",
      originalOnArtHref: "https://www.thelax.art/artworks/warm-basket-original",
    });
    expect(
      buildArtworkProductPage({ artwork: detail(), artistEditions: [], artBaseUrl: ART }).crossLinks
        .originalOnArtHref,
    ).toBeNull();
    expect(
      buildArtworkProductPage({
        artwork: detail({ sourceOriginalSlug: "warm-basket-original" }),
        artistEditions: [],
        artBaseUrl: null,
      }).crossLinks,
    ).toEqual({ artistOnArtHref: null, originalOnArtHref: null });
  });

  it("reads the size, the buy block and the included list from the record", () => {
    const vm = buildArtworkProductPage({ artwork: detail(), artistEditions: [], artBaseUrl: ART });
    expect(vm.sizeSummary).toBe("50 × 40 cm (19.7 × 15.7 in)");
    expect(vm.description).toBe("A still life.");
    expect(vm.purchase).toMatchObject({
      priceLabel: "£120.00",
      vatNote: "Includes VAT",
      editionSize: "Limited edition of 24",
      editionShort: "Edition of 24",
      availabilityLabel: "Available",
    });
    expect(vm.included[0]).toBe("Certificate of authenticity");
    expect(vm.gallery.scale).not.toBeNull();
    expect(vm.related.title).toBe("More by Emmett King");
  });

  it("shows edition, size and technique at a glance, or nothing with fewer than two", () => {
    const vm = buildArtworkProductPage({ artwork: detail(), artistEditions: [], artBaseUrl: ART });
    expect(vm.keyFacts).toEqual([
      { label: "Edition", value: "Edition of 24" },
      { label: "Size", value: "50 × 40 cm" },
      { label: "Technique", value: "Giclée print" },
    ]);
    const thin = buildArtworkProductPage({
      artwork: detail({ heightCm: null, widthCm: null, medium: null }),
      artistEditions: [],
      artBaseUrl: ART,
    });
    expect(thin.keyFacts).toEqual([]);
  });

  it("introduces the artist from their Shop profile, with their editions and lax.art story", () => {
    const vm = buildArtworkProductPage({
      artwork: detail(),
      artistEditions: [],
      artBaseUrl: ART,
      artistDetail: {
        slug: "emmett-king",
        name: "Emmett King",
        discipline: "Painter",
        bio: "A long biography.",
        shortBio: " Paints still lifes in Margate. ",
        portraitUrl: "/emmett.webp",
        artworkCount: 3,
      },
    });
    expect(vm.artist).toEqual({
      name: "Emmett King",
      discipline: "Painter",
      summary: "Paints still lifes in Margate.",
      portraitUrl: "/emmett.webp",
      editionsHref: "/artists/emmett-king",
      editionsLabel: "Editions by Emmett King",
      laxArtHref: "https://www.thelax.art/artists/emmett-king",
    });
    const unread = buildArtworkProductPage({
      artwork: detail(),
      artistEditions: [],
      artBaseUrl: null,
    });
    expect(unread.artist).toMatchObject({ summary: null, portraitUrl: null, laxArtHref: null });
  });

  it("shows other editions by the artist, available first, and only available ones when sold out", () => {
    const items = [
      summary({ slug: "warm-basket" }),
      summary({ slug: "sold", availability: { totalEditions: 24, state: "sold_out" } }),
      summary({ slug: "one" }),
      summary({ slug: "two" }),
    ];
    expect(
      selectRelatedEditions("warm-basket", items, { availableOnly: false }).map((i) => i.slug),
    ).toEqual(["one", "two", "sold"]);
    expect(
      selectRelatedEditions("warm-basket", items, { availableOnly: true }).map((i) => i.slug),
    ).toEqual(["one", "two"]);
    const soldOutPage = buildArtworkProductPage({
      artwork: detail({ availability: { totalEditions: 24, state: "sold_out" } }),
      artistEditions: items,
      artBaseUrl: ART,
    });
    expect(soldOutPage.related.items.map((i) => i.slug)).toEqual(["one", "two"]);
  });
});

describe("add to basket errors", () => {
  it("says an edition sold out without any count, and asks a guest to sign in", () => {
    const soldOut = addToBasketErrorMessage({
      error: "commerce_upstream_failed",
      code: "shop.out_of_stock",
      message: "Insufficient stock",
    });
    expect(soldOut.message).toBe(
      "This edition has just sold out, so it could not be added to your basket.",
    );
    expect(soldOut.message).not.toMatch(/\d/);
    expect(addToBasketErrorMessage({ error: "sign_in_required" })).toEqual({
      message: "Sign in to add this edition to your basket.",
      signIn: true,
    });
    expect(addToBasketErrorMessage(null).message).toBe(
      "We could not add this edition to your basket. Try again.",
    );
  });
});
