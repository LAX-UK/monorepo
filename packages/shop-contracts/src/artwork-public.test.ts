import { TypeCompiler } from "@sinclair/typebox/compiler";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  PublicArtworkDetailSchema,
  PublicArtworkEditionSchema,
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

  describe("editionCardLine", () => {
    const base = {
      slug: "demo",
      title: "Demo",
      artistName: "Artist",
      artistSlug: "artist",
      imageUrl: null,
      saleState: "for_sale",
      dimensions: null,
      medium: null,
      yearCreated: null,
      salesChannel: "shop",
      eligibleForEditionAllocation: true,
      printPricePence: 12000,
      availability: { totalEditions: 25, state: "available" },
    };

    it("is optional, so an older shop-api still parses", () => {
      expect(check.Check(base)).toBe(true);
    });

    it("accepts a line or null", () => {
      expect(check.Check({ ...base, editionCardLine: "Open edition · Plate-signed" })).toBe(true);
      expect(check.Check({ ...base, editionCardLine: null })).toBe(true);
    });

    it("rejects an empty line and a non-string", () => {
      expect(check.Check({ ...base, editionCardLine: "" })).toBe(false);
      expect(check.Check({ ...base, editionCardLine: 3 })).toBe(false);
    });
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

describe("PublicArtworkEditionSchema", () => {
  const edition = {
    run: { kind: "limited", size: 24 },
    facts: {
      numbering: "on_print",
      signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
      certificate: { kind: "none" },
    },
    proofsKept: { ap: 2, pp: 0, hc: 0 },
    otherRuns: [
      {
        slug: "demo-ap",
        run: { kind: "proof", proofType: "ap", size: 3 },
        facts: null,
        printPricePence: 65000,
        availability: "sold_out",
      },
    ],
  };

  it("accepts a run, its confirmed facts, kept proofs and the other runs", () => {
    expect(Value.Check(PublicArtworkEditionSchema, edition)).toBe(true);
  });

  it("keeps allocation, splits and remaining counts out of the public run", () => {
    expect(
      Value.Check(PublicArtworkEditionSchema, {
        ...edition,
        run: { kind: "limited", size: 24, allocation: { buyer: 10, artist: 10, lax: 4 } },
      }),
    ).toBe(false);
    expect(
      Value.Check(PublicArtworkEditionSchema, {
        ...edition,
        proofsKept: { ap: 2, pp: 0, hc: 0, bat: 1 },
      }),
    ).toBe(false);
    expect(JSON.stringify(PublicArtworkEditionSchema)).not.toMatch(/remaining|allocation|split/i);
  });
});
