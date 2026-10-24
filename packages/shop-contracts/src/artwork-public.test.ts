import { TypeCompiler } from "@sinclair/typebox/compiler";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  PublicArtworkDetailSchema,
  PublicArtworkSummarySchema,
  PublicEditionAvailabilitySchema,
} from "./artwork-public.js";

describe("PublicArtworkSummarySchema", () => {
  const check = TypeCompiler.Compile(PublicArtworkSummarySchema);

  it("accepts redacted public catalogue rows", () => {
    expect(
      check.Check({
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
      }),
    ).toBe(true);
  });

  it("rejects internal allocation fields", () => {
    expect(
      check.Check({
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
        availability: { totalEditions: 24, state: "available" },
        ownerPartyId: "secret",
      }),
    ).toBe(false);
  });

  it("rejects a remaining-edition count on the public availability", () => {
    expect(
      Value.Check(PublicEditionAvailabilitySchema, {
        totalEditions: 24,
        state: "available",
        editionsAvailable: 4,
      }),
    ).toBe(false);
    expect(
      Value.Check(PublicEditionAvailabilitySchema, { totalEditions: 24, editionsAvailable: 4 }),
    ).toBe(false);
    expect(
      Value.Check(PublicEditionAvailabilitySchema, { totalEditions: 24, state: "sold_out" }),
    ).toBe(true);
  });

  it("exposes no remaining-count field anywhere in the public artwork schemas", () => {
    const json = JSON.stringify([PublicArtworkSummarySchema, PublicArtworkDetailSchema]);
    expect(json).not.toMatch(/editionsAvailable|availableCount|sellableCount|remaining/i);
  });
});
