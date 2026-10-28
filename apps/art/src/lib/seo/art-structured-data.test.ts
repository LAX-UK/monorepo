import { artworkDetail } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import {
  artSiteJsonLd,
  artworkJsonLd,
  helpArticleJsonLd,
  storyJsonLd,
} from "./art-structured-data";

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

  it("never ties London Art Exchange to the auction company's social profiles", () => {
    for (const node of artSiteJsonLd(SITE)) {
      expect(node).not.toHaveProperty("sameAs");
      expect(JSON.stringify(node)).not.toMatch(
        /londonauctionxchange|lax\.bid|london-auction-xchange/,
      );
    }
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
      availability: { totalEditions: 10, state: "sold_out" },
    });
    expect(artworkJsonLd(edition, SITE)[0]?.offers).toMatchObject({
      price: "450.00",
      priceCurrency: "GBP",
      availability: "https://schema.org/SoldOut",
      seller: { name: "lax.art", legalName: "London Art Exchange Ltd" },
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

  it("marks a help answer up as a FAQ page with its plain-text answer", () => {
    const [faq, breadcrumb] = helpArticleJsonLd(
      {
        slug: "how-do-i-pay",
        question: "How do I pay?",
        categorySlug: "buying",
        categoryTitle: "Buying",
        answer: [
          { type: "heading", level: 2, text: "Cards" },
          { type: "richText", spans: [{ text: "Pay by " }, { text: "card", marks: ["bold"] }] },
          { type: "image", mediaKey: "https://example.test/a.webp" },
        ],
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      SITE,
    );
    expect(faq).toMatchObject({
      "@type": "FAQPage",
      url: "https://www.thelax.art/help/how-do-i-pay",
      mainEntity: [
        {
          "@type": "Question",
          name: "How do I pay?",
          acceptedAnswer: { "@type": "Answer", text: "Cards Pay by card" },
        },
      ],
    });
    expect(JSON.stringify(breadcrumb)).toContain("https://www.thelax.art/help?category=buying");
  });
});
