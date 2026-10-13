import { artworkDetail } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { artSiteJsonLd, artworkJsonLd, storyJsonLd } from "./art-structured-data";

const SITE = new URL("https://www.thelax.art/");

describe("Art structured data", () => {
  it("describes the gallery at its London address with catalogue search", () => {
    const [organization, gallery, website] = artSiteJsonLd(SITE);
    expect(organization).toMatchObject({ "@type": "Organization", url: "https://www.thelax.art" });
    expect(gallery).toMatchObject({
      "@type": "ArtGallery",
      address: { streetAddress: "156 New Cavendish Street", postalCode: "W1W 6YW" },
    });
    expect(website).toMatchObject({
      potentialAction: {
        target: { urlTemplate: "https://www.thelax.art/artworks?q={search_term_string}" },
      },
    });
  });

  it("marks up an original without inventing a price", () => {
    const [artwork, breadcrumb] = artworkJsonLd(artworkDetail({ heightCm: 50 }), SITE);
    expect(artwork).toMatchObject({
      "@type": "VisualArtwork",
      name: "Warm Basket",
      url: "https://www.thelax.art/artworks/warm-basket",
      image: ["https://www.thelax.art/warm-basket.webp"],
      creator: { name: "Flora Powers", url: "https://www.thelax.art/artists/flora-powers" },
      artform: "Painting",
      artMedium: "Oil on linen",
      dateCreated: "2024",
      height: { value: 50, unitCode: "CMT" },
    });
    expect(artwork).not.toHaveProperty("offers");
    expect(artwork).not.toHaveProperty("width");
    expect(breadcrumb).toMatchObject({ "@type": "BreadcrumbList" });
  });

  it("offers a priced edition and reports sell-outs", () => {
    const edition = artworkDetail({
      eligibleForEditionAllocation: true,
      printPricePence: 45000,
      availability: { totalEditions: 10, editionsAvailable: 0 },
    });
    expect(artworkJsonLd(edition, SITE)[0]?.offers).toMatchObject({
      price: "450.00",
      priceCurrency: "GBP",
      availability: "https://schema.org/SoldOut",
    });
  });

  it("marks up a story as an article", () => {
    const [article] = storyJsonLd(
      {
        slug: "news",
        kind: "article",
        title: "Gallery news",
        standfirst: "Spring opening.",
        coverUrl: "https://cdn.test/cover.jpg",
        featured: false,
        videoUrl: null,
        body: [],
        seoTitle: null,
        seoDescription: null,
      },
      SITE,
    );
    expect(article).toMatchObject({
      "@type": "Article",
      headline: "Gallery news",
      description: "Spring opening.",
      image: ["https://cdn.test/cover.jpg"],
      url: "https://www.thelax.art/stories/news",
    });
  });
});
