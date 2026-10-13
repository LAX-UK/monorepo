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
    availability: { totalEditions: 24, editionsAvailable: 4 },
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
    ...overrides,
  };
}
