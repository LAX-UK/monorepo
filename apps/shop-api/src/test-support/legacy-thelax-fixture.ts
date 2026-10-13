import type {
  LegacyArtwork,
  LegacyThelaxExport,
} from "../application/legacy-thelax/legacy-thelax-export.js";

const ORIGIN = "https://www.thelax.art";

/** Small export covering every family; `p` prefixes slugs so runs on a shared DB never collide. */
export function legacyThelaxFixture(p: string): LegacyThelaxExport {
  const artwork = (
    overrides: Partial<LegacyArtwork> & Pick<LegacyArtwork, "legacyPath" | "slug">,
  ) =>
    ({
      kind: "original",
      title: "A Flower",
      artistName: "Ada Phantom",
      artistLegacyPath: `/collections/${p}-ada.html`,
      sold: false,
      unique: true,
      certificate: true,
      year: 2024,
      dimensionsText: "70 x 60 cm",
      dimensions: { heightCm: 70, widthCm: 60, depthCm: null },
      description: "Oil study of a flower.",
      styles: [{ name: "Surrealism", legacyPath: `/art-style/${p}-surrealism.html` }],
      techniques: [{ name: "Oil on canvas", legacyPath: `/art-technique/${p}-oil.html` }],
      periods: [],
      images: [{ url: `${ORIGIN}/uds/stock/${p}-flower.jpg`, alt: "A Flower" }],
      seoTitle: "A Flower by Ada Phantom | Art for Sale | LAX",
      seoDescription: "A Flower, an original by Ada Phantom.",
      ...overrides,
    }) satisfies LegacyArtwork;

  return {
    schemaVersion: 1,
    origin: ORIGIN,
    generatedAt: "2026-10-13T00:00:00.000Z",
    artists: [
      {
        legacyPath: `/collections/${p}-ada.html`,
        slug: `${p}-ada`,
        name: "Ada Phantom",
        bio: "Ada paints flowers.",
        portraitUrl: `${ORIGIN}/uds/artists/${p}-ada.jpg`,
        seoTitle: "Ada Phantom | LAX",
        seoDescription: "Original art by Ada Phantom.",
      },
    ],
    artworks: [
      artwork({ legacyPath: `/collection/${p}-flower.html`, slug: `${p}-flower` }),
      artwork({
        legacyPath: `/print/${p}-flower.html`,
        slug: `${p}-flower`,
        kind: "print",
        unique: false,
        techniques: [{ name: "Giclee on paper", legacyPath: `/art-technique/${p}-giclee.html` }],
        images: [{ url: `${ORIGIN}/uds/stock/${p}-flower-print.jpg`, alt: null }],
      }),
      artwork({
        legacyPath: `/collection/${p}-sold.html`,
        slug: `${p}-sold`,
        title: "Sold Work",
        sold: true,
        artistName: "Bo Unlisted",
        artistLegacyPath: `/collections/${p}-bo.html`,
        images: [],
      }),
      artwork({ legacyPath: `/collection/${p}-taken.html`, slug: `${p}-taken` }),
    ],
    series: [
      {
        legacyPath: `/art-collection/${p}-blooms.html`,
        slug: `${p}-blooms`,
        name: "Blooms",
        artistLegacyPath: `/collections/${p}-ada.html`,
      },
      {
        legacyPath: `/art-collection/${p}-misc.html`,
        slug: `${p}-misc`,
        name: null,
        artistLegacyPath: null,
      },
    ],
    taxonomies: [
      {
        legacyPath: `/art-style/${p}-surrealism.html`,
        taxonomy: "style",
        slug: `${p}-surrealism`,
        name: "Surrealism",
        intro: null,
        seoTitle: "Surrealism | Art For Sale | LAX",
        seoDescription: "Surrealism, Art For Sale",
      },
    ],
    stories: [
      {
        legacyPath: `/news/${p}-story.html`,
        slug: `${p}-story`,
        title: "Collecting flowers",
        cover: { url: `${ORIGIN}/uds/articles/${p}-cover.jpg`, alt: "Cover" },
        body: [
          {
            type: "richText",
            spans: [
              { text: "See " },
              { text: "the flower", href: `${ORIGIN}/collection/${p}-flower.html` },
              { text: ", the " },
              { text: "old sitemap", href: `${ORIGIN}/site-map` },
              { text: " and " },
              { text: "an insecure link", href: "http://example.com/" },
              { text: " for more about collecting flowers." },
            ],
          },
          { type: "image", mediaKey: `${ORIGIN}/uds/articles/${p}-inline.jpg`, alt: "Inline" },
          { type: "image", mediaKey: `${ORIGIN}/uds/articles/${p}-missing.jpg`, alt: "Gone" },
          { type: "heading", level: 2, text: "" },
        ],
        seoTitle: "Collecting flowers | LAX",
        seoDescription: "How to collect flower paintings.",
      },
    ],
    pages: [
      {
        legacyPath: "/faq",
        slug: "faq",
        title: "FAQ",
        body: [{ type: "faqGroup", items: [{ question: "Q?", answer: [{ text: "A." }] }] }],
        seoTitle: "FAQ | LAX",
        seoDescription: null,
      },
      {
        legacyPath: "/contact-us",
        slug: "contact-us",
        title: "Contact",
        body: [],
        seoTitle: null,
        seoDescription: null,
      },
    ],
  };
}
