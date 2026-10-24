import type {
  ArtworkDetailReadModel,
  ArtworkSummaryReadModel,
} from "../application/read-models/catalogue.read-model.js";

export function mockArtworkSummary(
  overrides: Partial<ArtworkSummaryReadModel> = {},
): ArtworkSummaryReadModel {
  return {
    slug: "demo",
    title: "Demo",
    artistName: "Artist",
    artistSlug: "artist",
    imageUrl: null,
    saleState: "for_sale",
    dimensions: null,
    dimensionsCmDisplay: null,
    medium: null,
    yearCreated: null,
    objectType: null,
    rarity: null,
    salesChannel: "shop",
    eligibleForEditionAllocation: true,
    printPricePence: 12000,
    availability: { totalEditions: 24, state: "available" },
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function mockArtworkDetail(
  overrides: Partial<ArtworkDetailReadModel> = {},
): ArtworkDetailReadModel {
  return {
    ...mockArtworkSummary(overrides),
    description: null,
    images: [],
    heightCm: null,
    widthCm: null,
    depthCm: null,
    hasCertificate: false,
    provenance: null,
    exhibitionHistory: null,
    seoTitle: null,
    seoDescription: null,
    ...overrides,
  };
}
