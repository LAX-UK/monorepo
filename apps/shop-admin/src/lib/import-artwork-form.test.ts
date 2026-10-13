import { describe, expect, it } from "vitest";
import { ARTWORK_MEDIUM_MAX_LENGTH, buildImportArtworkInput } from "./import-artwork-form";

const fields = {
  importKey: " admin:1 ",
  slug: " harbour ",
  title: " Harbour ",
  primaryImageUrl: "",
  medium: "",
  artistSlug: " ada ",
  artistDisplayName: " Ada ",
  eligibleForEditionAllocation: false,
};

describe("buildImportArtworkInput", () => {
  it("trims required fields and sends a blank medium as null", () => {
    expect(buildImportArtworkInput(fields)).toEqual({
      ok: true,
      input: {
        importKey: "admin:1",
        slug: "harbour",
        title: "Harbour",
        description: null,
        primaryImageUrl: null,
        medium: null,
        artistSlug: "ada",
        artistDisplayName: "Ada",
        eligibleForEditionAllocation: false,
      },
    });
  });

  it("trims a provided medium", () => {
    const result = buildImportArtworkInput({ ...fields, medium: "  Oil on linen " });
    expect(result.ok && result.input.medium).toBe("Oil on linen");
  });

  it("accepts a medium at the max length and rejects one over it", () => {
    const atLimit = "x".repeat(ARTWORK_MEDIUM_MAX_LENGTH);
    expect(buildImportArtworkInput({ ...fields, medium: atLimit }).ok).toBe(true);
    expect(buildImportArtworkInput({ ...fields, medium: `${atLimit}x` })).toEqual({
      ok: false,
      error: "medium_too_long",
    });
  });

  it("omits blank SEO overrides so re-import keeps stored metadata", () => {
    const blank = buildImportArtworkInput({ ...fields, seoTitle: "  ", seoDescription: "" });
    expect(blank.ok && blank.input).not.toHaveProperty("seoTitle");
    expect(blank.ok && blank.input).not.toHaveProperty("seoDescription");
    const set = buildImportArtworkInput({ ...fields, seoTitle: " Harbour | LAX " });
    expect(set.ok && set.input.seoTitle).toBe("Harbour | LAX");
    expect(buildImportArtworkInput({ ...fields, seoDescription: "x".repeat(321) })).toEqual({
      ok: false,
      error: "seo_description_too_long",
    });
  });

  it("rejects missing required fields", () => {
    expect(buildImportArtworkInput({ ...fields, title: "   " })).toEqual({
      ok: false,
      error: "missing_required",
    });
  });
});
