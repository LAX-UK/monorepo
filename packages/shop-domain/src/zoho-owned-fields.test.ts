import { describe, expect, it } from "vitest";
import { ShopDomainError } from "./shop-domain-error.js";
import {
  ZOHO_OWNED_FIELDS_MESSAGE,
  assertZohoOwnedFieldsUnchanged,
  changedZohoOwnedFields,
  isZohoOwnedOriginal,
} from "./zoho-owned-fields.js";

const current = {
  title: "Tidal margin IV",
  artistId: "a1",
  yearCreated: 2024,
  medium: "Oil on linen",
  dimensions: "90 × 120 cm",
  images: ["k1", "k2"],
};

describe("isZohoOwnedOriginal", () => {
  const original = {
    zohoProductId: "z1",
    salesChannel: "art" as const,
    eligibleForEditionAllocation: false,
  };

  it("holds for a linked lax.art original", () => {
    expect(isZohoOwnedOriginal(original)).toBe(true);
  });

  it.each([
    ["unlinked", { ...original, zohoProductId: null }],
    ["a Shop listing", { ...original, salesChannel: "shop" as const }],
    ["an edition run", { ...original, eligibleForEditionAllocation: true }],
  ])("does not hold for %s", (_name, artwork) => {
    expect(isZohoOwnedOriginal(artwork)).toBe(false);
  });
});

describe("changedZohoOwnedFields", () => {
  it("is empty when nothing Zoho owns changed", () => {
    expect(changedZohoOwnedFields(current, { ...current, images: [...current.images] })).toEqual(
      [],
    );
  });

  it("names each changed field, and treats image order as a change", () => {
    expect(
      changedZohoOwnedFields(current, {
        ...current,
        title: "Other",
        medium: null,
        images: ["k2", "k1"],
      }),
    ).toEqual(["title", "medium", "images"]);
  });
});

describe("assertZohoOwnedFieldsUnchanged", () => {
  it("passes an unchanged save", () => {
    expect(() => assertZohoOwnedFieldsUnchanged(current, current)).not.toThrow();
  });

  it("refuses an edit in words that point to Zoho", () => {
    expect(() =>
      assertZohoOwnedFieldsUnchanged(current, { ...current, yearCreated: 1999 }),
    ).toThrow(new ShopDomainError(ZOHO_OWNED_FIELDS_MESSAGE));
  });
});
