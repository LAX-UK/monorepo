import { CREATOR_KIND_CONFIG, artistKinds } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  adminCreateArtistBodySchema,
  creatorAttributesSchemaForKind,
  parseCreatorAttributes,
} from "./artist.js";

describe("creator kind config registry", () => {
  it("has a config entry for every kind (OCP completeness)", () => {
    for (const kind of artistKinds) {
      expect(CREATOR_KIND_CONFIG[kind]).toBeDefined();
      expect(CREATOR_KIND_CONFIG[kind].kind).toBe(kind);
    }
  });

  it("builds an attribute schema for every kind", () => {
    for (const kind of artistKinds) {
      expect(() => creatorAttributesSchemaForKind(kind)).not.toThrow();
    }
  });

  it("keeps only declared, non-empty attribute keys", () => {
    const cleaned = parseCreatorAttributes("marque", {
      countryOfOrigin: "Italy",
      founderName: "",
      unknownKey: "ignored",
    });
    expect(cleaned).toEqual({ countryOfOrigin: "Italy" });
  });

  it("rejects attributes that violate the kind schema", () => {
    const result = adminCreateArtistBodySchema.safeParse({
      displayName: "Ferrari",
      kind: "marque",
      attributes: { countryOfOrigin: "x".repeat(500) },
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid kind-specific attributes", () => {
    const result = adminCreateArtistBodySchema.safeParse({
      displayName: "Ferrari",
      kind: "marque",
      attributes: { countryOfOrigin: "Italy", status: "Active" },
    });
    expect(result.success).toBe(true);
  });
});
