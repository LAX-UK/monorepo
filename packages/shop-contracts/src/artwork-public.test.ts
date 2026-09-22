import { TypeCompiler } from "@sinclair/typebox/compiler";
import { describe, expect, it } from "vitest";
import { PublicArtworkSummarySchema } from "./artwork-public.js";

describe("PublicArtworkSummarySchema", () => {
  const check = TypeCompiler.Compile(PublicArtworkSummarySchema);

  it("accepts redacted public catalogue rows", () => {
    expect(
      check.Check({
        slug: "demo",
        title: "Demo",
        artistName: "Artist",
        imageUrl: null,
        saleState: "for_sale",
        dimensions: null,
        yearCreated: null,
        eligibleForEditionAllocation: true,
        printPricePence: 12000,
        availability: { totalEditions: 24, editionsAvailable: 4 },
      }),
    ).toBe(true);
  });

  it("rejects internal allocation fields", () => {
    expect(
      check.Check({
        slug: "demo",
        title: "Demo",
        artistName: "Artist",
        imageUrl: null,
        saleState: "for_sale",
        dimensions: null,
        yearCreated: null,
        eligibleForEditionAllocation: true,
        availability: { totalEditions: 24, editionsAvailable: 24 },
        ownerPartyId: "secret",
      }),
    ).toBe(false);
  });
});
