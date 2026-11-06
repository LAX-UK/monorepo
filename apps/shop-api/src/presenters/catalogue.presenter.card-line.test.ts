import { describe, expect, it } from "vitest";
import type { ArtworkDetailReadModel } from "../application/read-models/catalogue.read-model.js";
import {
  presentArtistSummary,
  presentArtworkDetail,
  presentArtworkSummary,
} from "./catalogue.presenter.js";

const model: ArtworkDetailReadModel = {
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
  printPricePence: 1000,
  availability: { totalEditions: 25, state: "available" },
  updatedAt: "2026-10-01T00:00:00.000Z",
  listedAt: "2026-10-01T00:00:00.000Z",
  editionCardLine: "Limited edition of 25 · Hand-signed",
  description: null,
  images: [],
  heightCm: null,
  widthCm: null,
  depthCm: null,
  hasCertificate: false,
  printPaper: null,
  printSize: null,
  sourceOriginalSlug: null,
  provenance: null,
  exhibitionHistory: null,
  seoTitle: null,
  seoDescription: null,
} as ArtworkDetailReadModel;

describe("presentArtworkSummary edition card line", () => {
  it("passes the line through and is null when there is none", () => {
    expect(presentArtworkSummary(model).editionCardLine).toBe(
      "Limited edition of 25 · Hand-signed",
    );
    const { editionCardLine: _line, ...withoutLine } = model;
    expect(presentArtworkSummary(withoutLine).editionCardLine).toBeNull();
  });

  it("keeps the line off the detail response", () => {
    expect("editionCardLine" in presentArtworkDetail(model)).toBe(false);
  });
});

describe("version grouping and artist lead image", () => {
  it("passes the work slug on a summary only, so versions can be grouped", () => {
    expect(presentArtworkSummary({ ...model, workSlug: "demo-main" }).workSlug).toBe("demo-main");
    expect("workSlug" in presentArtworkSummary(model)).toBe(false);
    expect("workSlug" in presentArtworkDetail({ ...model, workSlug: "demo-main" })).toBe(false);
  });

  it("passes an artist's lead image, and nothing from an older read model", () => {
    const artist = { slug: "a", name: "A", discipline: null, portraitUrl: null, artworkCount: 1 };
    expect(
      presentArtistSummary({ ...artist, leadImageUrl: "https://cdn/x.jpg" }).leadImageUrl,
    ).toBe("https://cdn/x.jpg");
    expect("leadImageUrl" in presentArtistSummary(artist)).toBe(false);
  });
});
