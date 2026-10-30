import {
  SIGNED_IN_VIEWER,
  artworkDetail,
  artworkSummary,
  fakeArtServices,
} from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";

const SITE_URL = new URL("https://www.thelax.art/");
import {
  composeArtworkDetailMetadata,
  composeArtworkDetailPage,
} from "./artwork-detail-page.composer.js";

describe("composeArtworkDetailPage", () => {
  it("relates works by category first, tops up with the artist's works and excludes itself", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail());
    services.catalogue.listArtworks.mockImplementation(async (query: { relatedTo?: string }) =>
      query.relatedTo
        ? { items: [artworkSummary({ slug: "cat-1" }), artworkSummary({ slug: "shared" })] }
        : {
            items: [
              artworkSummary({ slug: "warm-basket" }),
              artworkSummary({ slug: "shared" }),
              artworkSummary({ slug: "artist-1" }),
              artworkSummary({ slug: "artist-2" }),
              artworkSummary({ slug: "artist-3" }),
            ],
          },
    );

    const result = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: false,
      siteUrl: SITE_URL,
    });

    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({
      relatedTo: "warm-basket",
      limit: 5,
    });
    expect(result.kind === "ok" && result.vm.relatedArtworks.map((card) => card.slug)).toEqual([
      "cat-1",
      "shared",
      "artist-1",
      "artist-2",
    ]);
  });

  it("titles the related rail after where its works came from", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockResolvedValue(
      artworkDetail({ artistSlug: "ada", artistName: "Ada Lane" }),
    );
    services.catalogue.listArtworks.mockImplementation(async (query) =>
      query.relatedTo
        ? { items: [artworkSummary({ slug: "peer", artistSlug: "someone-else" })] }
        : { items: [artworkSummary({ slug: "own", artistSlug: "ada" })] },
    );
    const collection = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: false,
      siteUrl: SITE_URL,
    });
    expect(collection.kind === "ok" && collection.vm.relatedSection).toEqual({
      title: "More in this collection",
      viewAllHref: "/artworks",
      viewAllSrLabel: "artworks",
    });

    services.catalogue.listArtworks.mockImplementation(async (query) =>
      query.relatedTo
        ? { items: [] }
        : { items: [artworkSummary({ slug: "own", artistSlug: "ada" })] },
    );
    const artistOnly = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: false,
      siteUrl: SITE_URL,
    });
    expect(artistOnly.kind === "ok" && artistOnly.vm.relatedSection).toEqual({
      title: "More by Ada Lane",
      viewAllHref: "/artists/ada",
      viewAllSrLabel: "works by Ada Lane",
    });
  });

  it("leaves the related rail out with fewer than three works", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail());
    services.catalogue.listArtworks.mockImplementation(async (query) =>
      query.relatedTo ? { items: [] } : { items: [artworkSummary({ slug: "own-1" })] },
    );
    const result = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: false,
      siteUrl: SITE_URL,
    });
    expect(result.kind === "ok" && result.vm.relatedArtworks).toEqual([]);
  });

  it("still renders when related reads fail", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail());
    services.catalogue.listArtworks.mockRejectedValue(new Error("down"));
    const result = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: false,
      siteUrl: SITE_URL,
    });
    expect(result.kind === "ok" && result.vm.relatedArtworks).toEqual([]);
  });

  it("returns not_found for unknown slugs", async () => {
    const services = fakeArtServices();
    await expect(
      composeArtworkDetailPage(services, {
        slug: "missing",
        enquireRequested: false,
        siteUrl: SITE_URL,
      }),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("returns unavailable when the catalogue fails", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockRejectedValue(new Error("down"));
    await expect(
      composeArtworkDetailPage(services, {
        slug: "warm-basket",
        enquireRequested: false,
        siteUrl: SITE_URL,
      }),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("lets guests enquire with empty contact fields and no sign-in step", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail());

    const result = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: true,
      siteUrl: SITE_URL,
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.vm.enquiry).toEqual({
      kind: "ready",
      contact: { name: "", email: "", phone: "" },
      artistName: "Flora Powers",
      imageUrl: "/warm-basket.webp",
      autoOpen: true,
      confirmation: expect.objectContaining({ title: "Enquiry sent" }),
    });
    expect(result.vm.priceLabel).toBe("Price on request");
    expect(result.vm.keySpecs).toEqual([
      { label: "Year", lines: ["2024"] },
      { label: "Type", lines: ["Painting"] },
      { label: "Medium", lines: ["Oil on linen"] },
      { label: "Dimensions", lines: ["40 × 50 cm"] },
    ]);
    expect(result.vm.promise?.reply).toBe("The gallery team replies within one working day.");
    expect(result.vm.faqs.length).toBeGreaterThan(0);
    expect(result.vm.favoriteAuth.loginHref).toBe("/login?returnTo=%2Fartworks%2Fwarm-basket");
    expect(result.vm.specialistContact).toEqual({
      kind: "ready",
      contact: { name: "", email: "", phone: "" },
      viewerKind: "guest",
    });
  });

  it("loads the artist block with the viewer's follow state", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail());
    services.catalogue.getArtist.mockResolvedValue({
      slug: "flora-powers",
      name: "Flora Powers",
      discipline: "Painter",
      bio: "Flora Powers paints still lifes.",
      portraitUrl: "/flora.webp",
      artworkCount: 3,
    });
    services.favorites.followedArtistSlugs.mockResolvedValue(new Set(["flora-powers"]));

    const result = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: false,
      siteUrl: SITE_URL,
    });

    expect(services.catalogue.getArtist).toHaveBeenCalledWith("flora-powers");
    expect(result.kind === "ok" && result.vm.artist).toEqual({
      slug: "flora-powers",
      name: "Flora Powers",
      href: "/artists/flora-powers",
      portraitUrl: "/flora.webp",
      bio: "Flora Powers paints still lifes.",
      facts: "Painter",
      following: true,
    });
    expect(result.kind === "ok" && result.vm.specialistContact).toEqual({
      kind: "ready",
      contact: { name: "Ada Collector", email: "ada@example.com", phone: "+447700900123" },
      viewerKind: "authenticated",
    });
  });

  it("hides the artist block when the artist read fails", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail());
    services.catalogue.getArtist.mockRejectedValue(new Error("down"));

    const result = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: false,
      siteUrl: SITE_URL,
    });

    expect(result.kind).toBe("ok");
    expect(result.kind === "ok" && result.vm.artist).toBeNull();
  });

  it("prefills the enquiry contact and saved state for signed-in viewers", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail());
    services.favorites.savedArtworkSlugs.mockResolvedValue(new Set(["warm-basket"]));

    const result = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: true,
      siteUrl: SITE_URL,
    });

    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.enquiry).toEqual({
      kind: "ready",
      contact: { name: "Ada Collector", email: "ada@example.com", phone: "+447700900123" },
      artistName: "Flora Powers",
      imageUrl: "/warm-basket.webp",
      autoOpen: true,
      confirmation: expect.objectContaining({ title: "Enquiry sent" }),
    });
    expect(result.vm.saved).toBe(true);
  });

  it("closes enquiries on sold works", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail({ saleState: "sold" }));

    const result = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: true,
      siteUrl: SITE_URL,
    });

    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.enquiry).toEqual({ kind: "unavailable" });
    expect(result.vm.priceLabel).toBe("Sold");
  });
});

describe("Editions available in LAX Shop", () => {
  const SHOP_LINK = {
    id: "shop" as const,
    label: "LAX Shop",
    href: "https://shop.thelax.art/",
    current: false,
    external: true,
  };
  const edition = artworkSummary({
    slug: "warm-basket-print",
    title: "Warm Basket (print)",
    salesChannel: "shop",
    eligibleForEditionAllocation: true,
    saleState: "for_sale",
    printPricePence: 12_000,
    availability: { totalEditions: 24, state: "available" },
  });

  it("lists an original's Shop editions with their Shop links, size and availability", async () => {
    const services = fakeArtServices();
    services.ecosystem.crossProductLinks.mockReturnValue([SHOP_LINK]);
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail());
    services.catalogue.listShopEditionsOfOriginal.mockResolvedValue({ items: [edition] });

    const result = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: false,
      siteUrl: SITE_URL,
    });

    expect(services.catalogue.listShopEditionsOfOriginal).toHaveBeenCalledWith("warm-basket", 4);
    expect(result.kind === "ok" && result.vm.shopEditions).toEqual([
      {
        slug: "warm-basket-print",
        title: "Warm Basket (print)",
        href: "https://shop.thelax.art/artworks/warm-basket-print",
        imageUrl: "/warm-basket.webp",
        artistName: "Flora Powers",
        editionLine: "Limited edition of 24 · Available",
        priceLabel: "£120.00",
      },
    ]);
  });

  it("leaves the section out without a Shop URL, for an edition, or when the read fails", async () => {
    const noShop = fakeArtServices();
    noShop.catalogue.getArtwork.mockResolvedValue(artworkDetail());
    noShop.catalogue.listShopEditionsOfOriginal.mockResolvedValue({ items: [edition] });
    const withoutShop = await composeArtworkDetailPage(noShop, {
      slug: "warm-basket",
      enquireRequested: false,
      siteUrl: SITE_URL,
    });
    expect(withoutShop.kind === "ok" && withoutShop.vm.shopEditions).toEqual([]);

    const failing = fakeArtServices();
    failing.ecosystem.crossProductLinks.mockReturnValue([SHOP_LINK]);
    failing.catalogue.getArtwork.mockResolvedValue(artworkDetail());
    failing.catalogue.listShopEditionsOfOriginal.mockRejectedValue(new Error("down"));
    const failed = await composeArtworkDetailPage(failing, {
      slug: "warm-basket",
      enquireRequested: false,
      siteUrl: SITE_URL,
    });
    expect(failed.kind === "ok" && failed.vm.shopEditions).toEqual([]);

    const ofEdition = fakeArtServices();
    ofEdition.ecosystem.crossProductLinks.mockReturnValue([SHOP_LINK]);
    ofEdition.catalogue.getArtwork.mockResolvedValue(
      artworkDetail({ eligibleForEditionAllocation: true }),
    );
    await composeArtworkDetailPage(ofEdition, {
      slug: "warm-basket",
      enquireRequested: false,
      siteUrl: SITE_URL,
    });
    expect(ofEdition.catalogue.listShopEditionsOfOriginal).not.toHaveBeenCalled();
  });
});

describe("composeArtworkDetailMetadata", () => {
  it("builds canonical metadata", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail({ description: null }));
    await expect(composeArtworkDetailMetadata(services.catalogue, "warm-basket")).resolves.toEqual({
      kind: "ok",
      title: "Warm Basket | lax.art",
      description: "Warm Basket by Flora Powers at lax.art.",
      canonicalPath: "/artworks/warm-basket",
      imageUrl: "/warm-basket.webp",
    });
  });

  it("prefers imported SEO overrides", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockResolvedValue(
      artworkDetail({
        seoTitle: "Warm Basket by Flora Powers | lax.art",
        seoDescription: "Original still life by Flora Powers.",
      }),
    );
    await expect(
      composeArtworkDetailMetadata(services.catalogue, "warm-basket"),
    ).resolves.toMatchObject({
      title: "Warm Basket by Flora Powers | lax.art",
      description: "Original still life by Flora Powers.",
    });
  });
});
